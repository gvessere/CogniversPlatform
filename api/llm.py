import os
import subprocess
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

DEEPSEEK_MODEL_DIR = Path("/app/models/deepseek-r1")
DEEPSEEK_MODEL_PATH = DEEPSEEK_MODEL_DIR / "model"

def ensure_model_downloaded():
    """Ensure DeepSeek R1 model is downloaded"""
    if not DEEPSEEK_MODEL_PATH.exists():
        logger.info("Downloading DeepSeek R1 model...")
        DEEPSEEK_MODEL_DIR.mkdir(parents=True, exist_ok=True)
        # TODO: Implement model download logic
        # This should download the model from HuggingFace or other source
        pass

def generate_with_deepseek(
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    stop_sequences: Optional[list[str]] = None,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """Generate text using DeepSeek R1 model"""
    ensure_model_downloaded()
    
    # Prepare the command
    cmd = [
        "python", "-m", "deepseek.r1",
        "--model", str(DEEPSEEK_MODEL_PATH),
        "--prompt", prompt,
        "--temperature", str(temperature),
        "--max_tokens", str(max_tokens)
    ]
    
    if system_prompt:
        cmd.extend(["--system_prompt", system_prompt])
    
    if stop_sequences:
        cmd.extend(["--stop", ",".join(stop_sequences)])
    
    try:
        # Run the model
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        return {
            "output": result.stdout,
            "error": None
        }
    except subprocess.CalledProcessError as e:
        logger.error(f"Error running DeepSeek R1: {e.stderr}")
        return {
            "output": None,
            "error": e.stderr
        } 