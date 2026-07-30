import { createServerFn } from "@tanstack/react-start";

export const verifyDomainAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => ({
    email: String(data?.email ?? "").trim().toLowerCase(),
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const expectedEmail = (process.env.DOMAIN_ADMIN_EMAIL ?? "deryroc@gmail.com")
      .trim()
      .toLowerCase();
    const expectedPassword =
      process.env.DOMAIN_ADMIN_PASSWORD ?? "Mathy29Meli18*53";

    if (data.email === expectedEmail && data.password === expectedPassword) {
      return { ok: true as const };
    }
    return { ok: false as const, error: "Identifiants non autorisés" };
  });
