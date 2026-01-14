import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  exchangeCodeForTokens,
  tokensToCredentials,
  type OAuthState,
  type ChatGPTCredentials,
} from "@/lib/chatgpt-auth";

const OAUTH_STATE_FILE = path.join(process.cwd(), "data", "oauth-state.json");
const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

function loadOAuthState(): OAuthState | null {
  try {
    if (fs.existsSync(OAUTH_STATE_FILE)) {
      const data = fs.readFileSync(OAUTH_STATE_FILE, "utf-8");
      return JSON.parse(data) as OAuthState;
    }
  } catch (error) {
    console.error("[ChatGPT Auth] Failed to load OAuth state:", error);
  }
  return null;
}

function clearOAuthState(): void {
  try {
    if (fs.existsSync(OAUTH_STATE_FILE)) {
      fs.unlinkSync(OAUTH_STATE_FILE);
    }
  } catch (error) {
    console.error("[ChatGPT Auth] Failed to clear OAuth state:", error);
  }
}

function saveCredentials(credentials: ChatGPTCredentials): void {
  try {
    let settings: Record<string, unknown> = {};

    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(data);
    }

    settings.chatgptCredentials = credentials;

    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (error) {
    console.error("[ChatGPT Auth] Failed to save credentials:", error);
    throw error;
  }
}

/**
 * GET /api/auth/chatgpt/callback
 *
 * Handles the OAuth callback from ChatGPT:
 * 1. Validates the state parameter to prevent CSRF
 * 2. Exchanges the authorization code for tokens
 * 3. Extracts account ID and email from the JWT
 * 4. Stores credentials in settings
 * 5. Redirects to settings page with success message
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Build base URL for redirects
  const baseUrl = `${url.protocol}//${url.host}`;

  // Handle OAuth errors
  if (error) {
    console.error("[ChatGPT Auth] OAuth error:", error, errorDescription);
    clearOAuthState();
    return NextResponse.redirect(
      `${baseUrl}/settings?auth_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    console.error("[ChatGPT Auth] Missing code or state parameter");
    clearOAuthState();
    return NextResponse.redirect(
      `${baseUrl}/settings?auth_error=${encodeURIComponent("Missing authorization parameters")}`
    );
  }

  // Load and validate OAuth state
  const storedState = loadOAuthState();

  if (!storedState) {
    console.error("[ChatGPT Auth] No stored OAuth state found");
    return NextResponse.redirect(
      `${baseUrl}/settings?auth_error=${encodeURIComponent("Authentication session expired. Please try again.")}`
    );
  }

  if (storedState.state !== state) {
    console.error("[ChatGPT Auth] State mismatch - possible CSRF attack");
    clearOAuthState();
    return NextResponse.redirect(
      `${baseUrl}/settings?auth_error=${encodeURIComponent("Invalid authentication state. Please try again.")}`
    );
  }

  // Check if state is too old (10 minutes max)
  const stateAge = Date.now() - storedState.createdAt;
  if (stateAge > 10 * 60 * 1000) {
    console.error("[ChatGPT Auth] OAuth state expired");
    clearOAuthState();
    return NextResponse.redirect(
      `${baseUrl}/settings?auth_error=${encodeURIComponent("Authentication session expired. Please try again.")}`
    );
  }

  try {
    // Build redirect URI (must match the one used in /start)
    const redirectUri = `${baseUrl}/api/auth/chatgpt/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      storedState.verifier,
      redirectUri
    );

    // Convert to credentials and extract account info
    const credentialsData = tokensToCredentials(tokens);

    if (!credentialsData.accountId) {
      throw new Error("Failed to extract ChatGPT account ID from token");
    }

    const credentials: ChatGPTCredentials = {
      accessToken: credentialsData.accessToken,
      refreshToken: credentialsData.refreshToken,
      expiresAt: credentialsData.expiresAt,
      accountId: credentialsData.accountId,
      email: credentialsData.email || undefined,
    };

    // Save credentials to settings
    saveCredentials(credentials);

    // Clear OAuth state
    clearOAuthState();

    // Redirect to settings with success
    return NextResponse.redirect(`${baseUrl}/settings?auth_success=chatgpt`);
  } catch (error) {
    console.error("[ChatGPT Auth] Token exchange failed:", error);
    clearOAuthState();

    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.redirect(
      `${baseUrl}/settings?auth_error=${encodeURIComponent(errorMessage)}`
    );
  }
}
