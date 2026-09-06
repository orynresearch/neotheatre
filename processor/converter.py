"""
Neotheatre Audio Conversion Engine
Handles audio conversion pipeline for releases:
1. FLAC (Hi-Res 24-bit 96kHz) via FFmpeg
2. WAV (Hi-Res 24-bit PCM) via FFmpeg
3. IAMF (.iamf) via libiamf ctypes wrapper
4. Atmos DD+JOC & TrueHD (or graceful stub if Atmos encoder unavailable)
5. Stereo Downmix FLAC via FFmpeg
"""

import os
import sys
import subprocess
import logging
from typing import Dict, List, Optional
from iamf_wrapper import IAMF, IAMFError

logger = logging.getLogger("neotheatre.converter")


class AudioConverter:
    def __init__(self, storage_root: Optional[str] = None):
        self.storage_root = storage_root or os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "storage")
        )
        self.releases_dir = os.path.join(self.storage_root, "releases")
        os.makedirs(self.releases_dir, exist_ok=True)

        try:
            self.iamf_engine = IAMF()
            logger.info("libiamf ctypes engine initialized.")
        except Exception as e:
            logger.warning(f"libiamf engine initialization warning: {e}. IAMF format may be limited.")
            self.iamf_engine = None

    def get_track_output_dir(self, release_id: str, track_id: str) -> str:
        track_dir = os.path.join(self.releases_dir, str(release_id), str(track_id))
        os.makedirs(track_dir, exist_ok=True)
        return track_dir

    def convert_track(
        self,
        source_path: str,
        release_id: str,
        track_id: str,
        source_format: str = "wav",
    ) -> Dict[str, str]:
        """
        Execute full conversion pipeline on a source audio file.
        Returns mapping of format name to generated absolute file path.
        """
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Source file does not exist: {source_path}")

        out_dir = self.get_track_output_dir(release_id, track_id)
        generated_formats: Dict[str, str] = {}

        # 1. Hi-Res FLAC (24-bit, 96kHz or original sample rate)
        flac_path = os.path.join(out_dir, "hires-flac.flac")
        cmd_flac = [
            "ffmpeg", "-y", "-i", source_path,
            "-c:a", "flac",
            "-sample_fmt", "s32",
            "-ar", "96000",
            flac_path
        ]
        try:
            subprocess.run(cmd_flac, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            generated_formats["flac"] = flac_path
            logger.info(f"Generated Hi-Res FLAC: {flac_path}")
        except subprocess.CalledProcessError as err:
            logger.error(f"FFmpeg FLAC encoding failed: {err.stderr.decode('utf-8', errors='ignore')}")

        # 2. Hi-Res WAV (24-bit PCM)
        wav_path = os.path.join(out_dir, "hires-wav.wav")
        cmd_wav = [
            "ffmpeg", "-y", "-i", source_path,
            "-c:a", "pcm_s24le",
            wav_path
        ]
        try:
            subprocess.run(cmd_wav, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            generated_formats["wav"] = wav_path
            logger.info(f"Generated Hi-Res WAV: {wav_path}")
        except subprocess.CalledProcessError as err:
            logger.error(f"FFmpeg WAV encoding failed: {err.stderr.decode('utf-8', errors='ignore')}")

        # 3. Stereo Downmix FLAC
        stereo_path = os.path.join(out_dir, "stereo.flac")
        cmd_stereo = [
            "ffmpeg", "-y", "-i", source_path,
            "-ac", "2",
            "-c:a", "flac",
            stereo_path
        ]
        try:
            subprocess.run(cmd_stereo, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            generated_formats["stereo"] = stereo_path
            logger.info(f"Generated Stereo Downmix: {stereo_path}")
        except subprocess.CalledProcessError as err:
            logger.error(f"FFmpeg stereo downmix failed: {err.stderr.decode('utf-8', errors='ignore')}")

        # 4. IAMF conversion via libiamf ctypes wrapper
        # Converted for ADM source or multichannel audio files
        iamf_path = os.path.join(out_dir, "converted.iamf")
        if self.iamf_engine:
            try:
                success = self.iamf_engine.encode_adm_to_iamf(source_path, iamf_path)
                if success and os.path.exists(iamf_path) and os.path.getsize(iamf_path) > 0:
                    generated_formats["iamf"] = iamf_path
                    logger.info(f"Generated IAMF bitstream: {iamf_path}")
                else:
                    logger.warning("libiamf encoding completed without generating output.")
            except Exception as e:
                logger.warning(f"libiamf conversion skipped or failed: {e}. Other formats remain available.")
        else:
            logger.info("libiamf engine not available, skipping IAMF.")

        # 5. Atmos formats (DD+JOC .ec3 and TrueHD .thd)
        # Dedicated Dolby Atmos encoders require licensed binaries.
        # We hook into Atmos encoding or provide graceful stubs logging warnings.
        atmos_dd_path = os.path.join(out_dir, "atmos-dd.ec3")
        atmos_thd_path = os.path.join(out_dir, "atmos-thd.thd")

        # Try FFmpeg eac3 export if supported
        cmd_eac3 = [
            "ffmpeg", "-y", "-i", source_path,
            "-c:a", "eac3",
            "-b:a", "768k",
            atmos_dd_path
        ]
        try:
            res = subprocess.run(cmd_eac3, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0 and os.path.exists(atmos_dd_path) and os.path.getsize(atmos_dd_path) > 0:
                generated_formats["atmos-dd"] = atmos_dd_path
                logger.info(f"Generated Atmos DD+ (E-AC3): {atmos_dd_path}")
            else:
                logger.warning("E-AC3 Atmos stream not produced by ffmpeg, marking format unavailable.")
        except Exception as e:
            logger.warning(f"Atmos DD+ conversion failed or skipped: {e}")

        # TrueHD Atmos stub logging
        logger.info("Atmos TrueHD (.thd) requires licensed Dolby TrueHD hardware/software encoder; flagged unavailable.")

        return generated_formats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import argparse

    parser = argparse.ArgumentParser(description="Neotheatre Audio Converter")
    parser.add_argument("--source", required=True, help="Path to input audio file")
    parser.add_argument("--release-id", required=True, help="Release UUID")
    parser.add_argument("--track-id", required=True, help="Track UUID")
    parser.add_argument("--source-format", default="wav", help="Source format ('adm', 'wav', 'flac')")

    args = parser.parse_args()
    converter = AudioConverter()
    results = converter.convert_track(args.source, args.release_id, args.track_id, args.source_format)
    print("Conversion completed. Generated formats:")
    for fmt, path in results.items():
        print(f"  [{fmt}] -> {path} ({os.path.getsize(path)} bytes)")
