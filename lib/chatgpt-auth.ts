/**
 * ChatGPT OAuth Authentication Library
 *
 * Implements OAuth 2.0 with PKCE for ChatGPT Plus/Pro authentication.
 * Uses the same OAuth flow as OpenAI's official Codex CLI.
 */

import crypto from "crypto";

// OAuth Configuration (same as OpenAI Codex CLI)
export const CHATGPT_OAUTH_CONFIG = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access",
  // This will be set dynamically based on the app's URL
  redirectUri: "/api/auth/chatgpt/callback",
};

// ChatGPT Backend API
export const CHATGPT_API_CONFIG = {
  baseUrl: "https://chatgpt.com/backend-api",
  codexResponsesPath: "/codex/responses",
};

// JWT claim path for extracting ChatGPT account ID
export const JWT_CLAIM_PATH = "https://api.openai.com/auth";

/**
 * PKCE (Proof Key for Code Exchange) pair
 */
export interface PKCEPair {
  verifier: string;
  challenge: string;
}

/**
 * OAuth token response
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Stored ChatGPT credentials
 */
export interface ChatGPTCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  accountId: string;
  email?: string;
}

/**
 * JWT Payload structure for ChatGPT tokens
 */
export interface ChatGPTJWTPayload {
  [JWT_CLAIM_PATH]?: {
    chatgpt_account_id?: string;
    user_id?: string;
  };
  email?: string;
  sub?: string;
  exp?: number;
  iat?: number;
}

/**
 * OAuth state stored during the flow
 */
export interface OAuthState {
  state: string;
  verifier: string;
  createdAt: number;
}

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

/**
 * Generate a SHA256 hash and encode as base64url
 */
function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

/**
 * Generate PKCE verifier and challenge pair
 * The verifier is a random string, and the challenge is its SHA256 hash
 */
export function generatePKCE(): PKCEPair {
  // Generate a random verifier (43-128 characters as per RFC 7636)
  const verifier = generateRandomString(32);
  // Challenge is the base64url-encoded SHA256 hash of the verifier
  const challenge = sha256Base64Url(verifier);

  return { verifier, challenge };
}

/**
 * Generate a random state value for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Build the OAuth authorization URL
 */
export function buildAuthorizationUrl(
  pkce: PKCEPair,
  state: string,
  redirectUri: string
): string {
  const url = new URL(CHATGPT_OAUTH_CONFIG.authorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CHATGPT_OAUTH_CONFIG.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", CHATGPT_OAUTH_CONFIG.scope);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  // Additional parameters used by Codex CLI
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", "codex_cli_rs");

  return url.toString();
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const response = await fetch(CHATGPT_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CHATGPT_OAUTH_CONFIG.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "[ChatGPT Auth] Token exchange failed:",
      response.status,
      errorText
    );
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const tokens = (await response.json()) as TokenResponse;

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Invalid token response: missing required fields");
  }

  return tokens;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const response = await fetch(CHATGPT_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CHATGPT_OAUTH_CONFIG.clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "[ChatGPT Auth] Token refresh failed:",
      response.status,
      errorText
    );
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const tokens = (await response.json()) as TokenResponse;

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Invalid refresh response: missing required fields");
  }

  return tokens;
}

/**
 * Decode a JWT token without verification
 * (We trust OpenAI's tokens, we just need to extract claims)
 */
export function decodeJWT(token: string): ChatGPTJWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // Handle base64url encoding
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded) as ChatGPTJWTPayload;
  } catch (error) {
    console.error("[ChatGPT Auth] Failed to decode JWT:", error);
    return null;
  }
}

/**
 * Extract ChatGPT account ID from access token
 */
export function extractAccountId(accessToken: string): string | null {
  const payload = decodeJWT(accessToken);
  if (!payload) {
    return null;
  }

  const authClaims = payload[JWT_CLAIM_PATH];
  return authClaims?.chatgpt_account_id || null;
}

/**
 * Extract email from access token
 */
export function extractEmail(accessToken: string): string | null {
  const payload = decodeJWT(accessToken);
  return payload?.email || null;
}

/**
 * Check if credentials are expired or about to expire
 * Returns true if token expires within the next 5 minutes
 */
export function isTokenExpired(credentials: ChatGPTCredentials): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return Date.now() >= credentials.expiresAt - bufferMs;
}

/**
 * Convert token response to stored credentials
 */
export function tokensToCredentials(
  tokens: TokenResponse
): Omit<ChatGPTCredentials, "accountId" | "email"> & {
  accountId: string | null;
  email: string | null;
} {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    accountId: extractAccountId(tokens.access_token),
    email: extractEmail(tokens.access_token),
  };
}

/**
 * Build headers for ChatGPT API requests
 */
export function buildChatGPTHeaders(
  accessToken: string,
  accountId: string
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "chatgpt-account-id": accountId,
    "OpenAI-Beta": "responses=experimental",
    originator: "codex_cli_rs",
  };
}

/**
 * Available ChatGPT/Codex models
 */
export const CHATGPT_MODELS = [
  // GPT-5.2 family
  { id: "gpt-5.2", name: "GPT-5.2", variant: "medium" },
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", variant: "medium" },
  // GPT-5.1 Codex family
  { id: "gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", variant: "high" },
  { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", variant: "medium" },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", variant: "medium" },
  // GPT-5.1 base
  { id: "gpt-5.1", name: "GPT-5.1", variant: "medium" },
] as const;

export type ChatGPTModelId = (typeof CHATGPT_MODELS)[number]["id"];
