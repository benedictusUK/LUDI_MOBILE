import appleSignin from "apple-signin-auth";

export async function verifyAppleMobileToken(idToken: string) {
  // Expo Launch signs LUDI as app.replit.ludi; locally built standalone apps
  // use the bundle identifier in app.json. Trust only these LUDI identifiers,
  // unless an operator explicitly configures a different mobile client ID.
  const configuredAudience = process.env.APPLE_MOBILE_CLIENT_ID;
  const audiences = configuredAudience
    ? [configuredAudience]
    : ["app.replit.ludi", "com.ludi.mobile"];

  // Expo Go's shared audience is never accepted by the published server.
  if (process.env.NODE_ENV !== "production") {
    audiences.push("host.exp.Exponent");
  }

  const { sub, email } = await appleSignin.verifyIdToken(idToken, {
    audience: audiences,
    ignoreExpiration: false,
  });

  if (!sub) {
    throw new Error("Apple identity token has no subject");
  }

  return { sub, email: typeof email === "string" ? email : null };
}