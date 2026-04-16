declare module "speakeasy" {
  type GenerateSecretOptions = {
    length?: number;
    name?: string;
    issuer?: string;
  };

  type GeneratedSecret = {
    ascii: string;
    base32: string;
    hex: string;
    otpauth_url?: string;
  };

  type TotpVerifyOptions = {
    secret: string;
    encoding: "ascii" | "base32" | "hex";
    token: string;
    window?: number;
  };

  const speakeasy: {
    generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
    totp: {
      verify(options: TotpVerifyOptions): boolean;
    };
  };

  export default speakeasy;
}
