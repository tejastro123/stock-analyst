import subprocess
import json
import os
import sys
from pathlib import Path

# Resolve CLI path
CLI_PATH = Path(__file__).parent.parent / "tradingview-mcp" / "src" / "cli" / "index.js"

def run_cli_command(command_args: list) -> dict:
    """Runs a TradingView MCP CLI command and returns parsed JSON or error."""
    if not CLI_PATH.exists():
        return {
            "success": False,
            "error": f"TradingView MCP CLI not found at path: {CLI_PATH}"
        }
    
    try:
        # Use node to run the script
        args = ["node", str(CLI_PATH)] + command_args
        
        # In Windows, we hide the cmd window if calling from a GUI process, though Streamlit is a terminal-run server
        creation_flag = 0
        if os.name == 'nt':
            creation_flag = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0x08000000
            
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            check=False,
            creationflags=creation_flag
        )
        
        if result.returncode == 0:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {
                    "success": True,
                    "raw_output": result.stdout.strip()
                }
        else:
            return {
                "success": False,
                "error": result.stderr.strip() or result.stdout.strip() or f"Process exited with code {result.returncode}"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def tv_health_check() -> dict:
    """Checks the CDP connection to TradingView Desktop."""
    return run_cli_command(["status"])

def tv_launch(kill_existing: bool = True) -> dict:
    """Launches TradingView Desktop with CDP port 9222 enabled."""
    args = ["launch"]
    if not kill_existing:
        args.append("--no-kill")
    return run_cli_command(args)

def chart_get_state() -> dict:
    """Gets the current chart symbol, resolution, and visible study indicators."""
    return run_cli_command(["state"])

def quote_get(symbol: str = None) -> dict:
    """Gets a real-time price snapshot for a symbol (or active symbol if None)."""
    args = ["quote"]
    if symbol:
        args.append(symbol)
    return run_cli_command(args)

def chart_set_symbol(symbol: str) -> dict:
    """Sets the active chart symbol on TradingView Desktop."""
    return run_cli_command(["symbol", symbol])

def chart_set_timeframe(timeframe: str) -> dict:
    """Sets the active chart timeframe on TradingView Desktop."""
    return run_cli_command(["timeframe", timeframe])

def chart_set_type(chart_type: str) -> dict:
    """Sets the active chart type (e.g. Candles, Line, HeikinAshi)."""
    return run_cli_command(["type", chart_type])

def capture_screenshot(region: str = "chart", filename: str = None) -> dict:
    """Takes a screenshot of the active TradingView chart and saves it locally."""
    args = ["screenshot", "-r", region]
    if filename:
        args += ["-o", filename]
    return run_cli_command(args)

def data_get_study_values() -> dict:
    """Retrieves numeric values from all active indicator studies on the chart."""
    return run_cli_command(["values"])

def data_get_ohlcv(count: int = 100, summary: bool = True) -> dict:
    """Fetches historical price bars or summary stats from the active chart."""
    args = ["ohlcv", "-n", str(count)]
    if summary:
        args.append("-s")
    return run_cli_command(args)

def data_get_pine_lines(filter_str: str = None, verbose: bool = False) -> dict:
    """Retrieves horizontal levels drawn by Pine Script indicators."""
    args = ["data", "lines"]
    if filter_str:
        args += ["-f", filter_str]
    if verbose:
        args.append("-v")
    return run_cli_command(args)

def data_get_pine_labels(filter_str: str = None, max_labels: int = 50, verbose: bool = False) -> dict:
    """Retrieves text annotations/labels drawn by Pine Script indicators."""
    args = ["data", "labels", "-n", str(max_labels)]
    if filter_str:
        args += ["-f", filter_str]
    if verbose:
        args.append("-v")
    return run_cli_command(args)

def data_get_pine_tables(filter_str: str = None) -> dict:
    """Retrieves tabular data drawn by Pine Script indicators."""
    args = ["data", "tables"]
    if filter_str:
        args += ["-f", filter_str]
    return run_cli_command(args)

def data_get_pine_boxes(filter_str: str = None, verbose: bool = False) -> dict:
    """Retrieves bounding boxes drawn by Pine Script indicators."""
    args = ["data", "boxes"]
    if filter_str:
        args += ["-f", filter_str]
    if verbose:
        args.append("-v")
    return run_cli_command(args)
