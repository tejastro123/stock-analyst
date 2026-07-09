#!/usr/bin/env node

/**
 * local-ollama-agent — Standalone agent that hooks Ollama (Mistral) to TradingView Desktop.
 * Exposes core tools directly without MCP protocol overhead.
 * Uses a ReAct JSON-mode loop for maximum compatibility and reliability.
 *
 * Usage:
 *   Interactive: node scripts/ollama_agent.js
 *   Command:     node scripts/ollama_agent.js "Change symbol to TSLA and get price"
 */

import readline from 'node:readline';
import { getState, setSymbol, setTimeframe, setType, manageIndicator } from '../src/core/chart.js';
import { getQuote, getOhlcv, getStudyValues, getPineLines, getPineLabels, getPineTables, getPineBoxes } from '../src/core/data.js';
import { captureScreenshot } from '../src/core/capture.js';
import { drawShape, clearAll } from '../src/core/drawing.js';
import { setSource, smartCompile, getErrors } from '../src/core/pine.js';
import { healthCheck, launch } from '../src/core/health.js';

// Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

// Colors for terminal formatting
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

// Map of function names to actual JS handlers
const toolHandlers = {
  tv_health_check: healthCheck,
  tv_launch: launch,
  chart_get_state: getState,
  quote_get: getQuote,
  data_get_study_values: getStudyValues,
  data_get_ohlcv: getOhlcv,
  chart_set_symbol: setSymbol,
  chart_set_timeframe: setTimeframe,
  chart_set_type: setType,
  chart_manage_indicator: manageIndicator,
  draw_shape: drawShape,
  draw_clear: clearAll,
  capture_screenshot: captureScreenshot,
  pine_set_source: setSource,
  pine_smart_compile: smartCompile,
  pine_get_errors: getErrors
};

// System instructions to shape the agent's behavior
const SYSTEM_INSTRUCTION = `You are a local trading assistant connected to TradingView Desktop.
You have access to a set of functions (tools) that you can call to read and write chart data:

1. tv_health_check - Check connection health to TradingView. Parameters: {}
2. tv_launch - Launch TradingView Desktop. Parameters: { kill_existing: boolean }
3. chart_get_state - Get current chart state (symbol, timeframe, indicators). Parameters: {}
4. quote_get - Get real-time price snapshot (last, high, low, close). Parameters: { symbol: string }
5. data_get_study_values - Get current values from all visible technical indicators. Parameters: {}
6. data_get_ohlcv - Get historical price bars. Parameters: { count: integer, summary: boolean }
7. chart_set_symbol - Change symbol of the active chart. Parameters: { symbol: string }
8. chart_set_timeframe - Change chart timeframe. Parameters: { timeframe: string }
9. chart_set_type - Change chart type style (Candles, Bars, Line, HeikinAshi). Parameters: { chart_type: string }
10. chart_manage_indicator - Add or remove indicator. Parameters: { action: "add"|"remove", indicator: string, entity_id: string }
11. draw_shape - Draw shape on chart. Parameters: { shape: string, point: {time: number, price: number}, point2: {time: number, price: number}, text: string }
12. draw_clear - Clear all drawings/shapes. Parameters: {}
13. capture_screenshot - Capture screenshot. Parameters: { region: "full"|"chart"|"strategy_tester" }
14. pine_set_source - Inject Pine Script code. Parameters: { source: string }
15. pine_smart_compile - Compile Pine Script and check for errors. Parameters: {}
16. pine_get_errors - Retrieve Pine compilation errors. Parameters: {}

You MUST reply ONLY with a single JSON object. Do not add any text before or after the JSON.
The JSON must follow one of these two schemas exactly:

If you need to call a tool:
{
  "thought": "Your reasoning about why you are calling this tool and what you expect to find",
  "action": "call",
  "tool": "tool_name",
  "arguments": { ... }
}

If you have gathered enough information and are ready to answer the user's question or confirm the action is complete:
{
  "thought": "Your final thoughts/analysis",
  "action": "respond",
  "response": "Your final message to the user"
}

Perform your operations step-by-step. If you need to do multiple things, do them one by one. Run one tool, wait for the result, then run the next tool in the next turn.`;

/**
 * Sends a chat completion request to the local Ollama instance with format: 'json'
 */
async function queryOllama(messages) {
  const url = `${OLLAMA_HOST}/api/chat`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: messages,
      stream: false,
      format: 'json'
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned status ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Handles agent loop execution for a prompt
 */
async function runAgent(prompt, messageHistory = []) {
  if (messageHistory.length === 0) {
    messageHistory.push({ role: 'system', content: SYSTEM_INSTRUCTION });
  }
  messageHistory.push({ role: 'user', content: prompt });

  console.log(`\n${COLORS.bright}${COLORS.blue}Agent thinking...${COLORS.reset}`);

  let runLoop = true;
  let maxTurns = 12;
  let turn = 0;

  while (runLoop && turn < maxTurns) {
    turn++;
    try {
      const response = await queryOllama(messageHistory);
      const assistantMessage = response.message;
      
      let parsed;
      try {
        parsed = JSON.parse(assistantMessage.content.trim());
      } catch (err) {
        console.error(`\n${COLORS.red}Error parsing agent JSON output: ${err.message}${COLORS.reset}`);
        console.log(`Raw output: ${assistantMessage.content}`);
        break;
      }

      // Record assistant's JSON response in history
      messageHistory.push(assistantMessage);

      // Print thought if present
      if (parsed.thought) {
        console.log(`\n${COLORS.bright}${COLORS.cyan}Thought:${COLORS.reset} ${parsed.thought}`);
      }

      if (parsed.action === 'call') {
        const fnName = parsed.tool;
        const fnArgs = parsed.arguments || {};

        console.log(`${COLORS.bright}${COLORS.yellow}Executing Tool:${COLORS.reset} ${fnName}(${JSON.stringify(fnArgs)})`);

        const handler = toolHandlers[fnName];
        if (!handler) {
          console.log(`${COLORS.red}Error: Unknown tool handler for '${fnName}'${COLORS.reset}`);
          messageHistory.push({
            role: 'user',
            content: JSON.stringify({ tool_result: { success: false, error: `Tool '${fnName}' is not supported.` } })
          });
          continue;
        }

        try {
          const result = await handler(fnArgs);
          console.log(`${COLORS.green}Tool Output:${COLORS.reset}`, JSON.stringify(result).substring(0, 180) + (JSON.stringify(result).length > 180 ? '...' : ''));

          // Pass the tool output back as a user response in the next chat history step
          messageHistory.push({
            role: 'user',
            content: JSON.stringify({ tool_result: result })
          });
        } catch (err) {
          console.log(`${COLORS.red}Tool Error:${COLORS.reset} ${err.message}`);
          messageHistory.push({
            role: 'user',
            content: JSON.stringify({ tool_result: { success: false, error: err.message } })
          });
        }
      } else if (parsed.action === 'respond') {
        console.log(`\n${COLORS.bright}${COLORS.green}Assistant:${COLORS.reset} ${parsed.response}`);
        runLoop = false;
      } else {
        console.log(`${COLORS.red}Error: Unknown agent action '${parsed.action}'${COLORS.reset}`);
        break;
      }
    } catch (err) {
      console.error(`\n${COLORS.red}Ollama API Error: ${err.message}${COLORS.reset}`);
      console.log(`${COLORS.yellow}Make sure Ollama is running ('ollama run ${DEFAULT_MODEL}') and accessible at ${OLLAMA_HOST}.${COLORS.reset}\n`);
      break;
    }
  }

  return messageHistory;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  console.clear();
  console.log(`${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}     TradingView Local Ollama Agent (${DEFAULT_MODEL})     ${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}`);
  console.log(`${COLORS.gray}Target Ollama: ${OLLAMA_HOST} | Model: ${DEFAULT_MODEL}${COLORS.reset}\n`);

  if (args.length > 0) {
    // Single command execution
    const prompt = args.join(' ');
    console.log(`${COLORS.bright}Prompt:${COLORS.reset} ${prompt}`);
    await runAgent(prompt);
    process.exit(0);
  } else {
    // Interactive CLI mode
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let messageHistory = [{ role: 'system', content: SYSTEM_INSTRUCTION }];

    const promptUser = () => {
      rl.question(`\n${COLORS.bright}${COLORS.cyan}You > ${COLORS.reset}`, async (input) => {
        const trimmed = input.trim();
        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          console.log('\nGoodbye!');
          rl.close();
          process.exit(0);
        }
        if (trimmed === '') {
          promptUser();
          return;
        }

        messageHistory = await runAgent(trimmed, messageHistory);
        promptUser();
      });
    };

    promptUser();
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
