import { Router, type IRouter } from "express";
import { connectors, requireAuth } from "../lib/supabase";

const router: IRouter = Router();

function toSession(data: Record<string, unknown>, fallbackEmail: string) {
  const user = data.user as Record<string, unknown> | null;
  return {
    accessToken: typeof data.access_token === "string" ? data.access_token : "",
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "",
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 3600,
    user: {
      id: typeof user?.id === "string" ? user.id : "",
      email: typeof user?.email === "string" ? user.email : fallbackEmail,
    },
  };
}

router.post("/auth/signup", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "password must be at least 6 characters." });
  }

  let response: Awaited<ReturnType<typeof connectors.proxy>>;
  try {
    response = await connectors.proxy("supabase", "/auth/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return res.status(502).json({ message: "Unable to reach Supabase Auth. Check connector configuration." });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return res.status(502).json({ message: "Supabase Auth returned an unparseable response." });
  }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    const msg = typeof d?.msg === "string" ? d.msg : typeof d?.message === "string" ? d.message : "Signup failed.";
    const status = response.status === 422 ? 409 : response.status >= 400 && response.status < 500 ? 400 : 502;
    return res.status(status).json({ message: msg });
  }

  const d = data as Record<string, unknown>;
  const session = d.session as Record<string, unknown> | null;
  const user = (d.user ?? (session?.user)) as Record<string, unknown> | null;

  if (!session || !user) {
    // Supabase may require email confirmation — return a useful message.
    return res.status(200).json({
      confirmationRequired: true,
      message: "Account created. Check your email to confirm before logging in.",
      user: {
        id: typeof user?.id === "string" ? user.id : "",
        email: typeof user?.email === "string" ? user.email : email,
      },
    });
  }

  return res.status(200).json({
    confirmationRequired: false,
    user: {
      id: typeof user.id === "string" ? user.id : "",
      email: typeof user.email === "string" ? user.email : email,
    },
    session: toSession(session, email),
  });
});

router.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required." });
  }

  let response: Awaited<ReturnType<typeof connectors.proxy>>;
  try {
    response = await connectors.proxy(
      "supabase",
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    );
  } catch {
    return res.status(502).json({ message: "Unable to reach Supabase Auth. Check connector configuration." });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return res.status(502).json({ message: "Supabase Auth returned an unparseable response." });
  }

  if (!response.ok) {
    const d = data as Record<string, unknown>;
    const msg =
      typeof d?.error_description === "string"
        ? d.error_description
        : typeof d?.message === "string"
          ? d.message
          : "Invalid email or password.";
    const status = response.status === 400 ? 401 : response.status >= 400 && response.status < 500 ? 400 : 502;
    return res.status(status).json({ message: msg });
  }

  return res.status(200).json(toSession(data as Record<string, unknown>, email));
});

router.post("/auth/refresh", async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (!refreshToken) return res.status(400).json({ message: "refreshToken is required." });

  let response: Awaited<ReturnType<typeof connectors.proxy>>;
  try {
    response = await connectors.proxy("supabase", "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    return res.status(502).json({ message: "Unable to reach Supabase Auth. Check connector configuration." });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return res.status(502).json({ message: "Supabase Auth returned an unparseable response." });
  }
  if (!response.ok) {
    const d = data as Record<string, unknown>;
    const message = typeof d.error_description === "string" ? d.error_description : "Refresh token is invalid or expired.";
    return res.status(response.status >= 400 && response.status < 500 ? 401 : 502).json({ message });
  }
  const session = toSession(data as Record<string, unknown>, "");
  if (!session.accessToken || !session.refreshToken || !session.user.id) {
    return res.status(502).json({ message: "Supabase Auth did not return a complete refreshed session." });
  }
  return res.status(200).json(session);
});

router.get("/auth/me", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  return res.status(200).json({ id: user.id, email: user.email });
});

export default router;
