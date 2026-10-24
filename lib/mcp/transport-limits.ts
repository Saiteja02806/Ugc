// Media bytes use owned signed uploads. These limits bound only MCP JSON.
export const MCP_MAX_REQUEST_BYTES = 64 * 1024;
// Two full framing tracks (512 points × four counted elements), overlays and
// ordinary tool fields fit comfortably; adversarial collections stay bounded.
export const MCP_MAX_TOOL_INPUT_ELEMENTS = 10_000;
