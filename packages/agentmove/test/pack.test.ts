import { describe, expect, it } from "vitest";
import { decryptBundle, encryptBundle, isPack, PACK_MAGIC } from "../src/pack.js";
import { CliError, emptyBundle } from "../src/model.js";

describe("agentpack encryption", () => {
  const bundle = () => {
    const b = emptyBundle();
    b.manifest.exportedFrom = "openclaw";
    b.mcpServers = [
      {
        name: "api",
        transport: "http",
        url: "https://mcp.example.com/mcp",
        headers: { Authorization: "${Authorization}" },
      },
    ];
    b.instructions = "Use pnpm.";
    b.memory = [{ content: "note", source: "MEMORY.md", kind: "long-term" }];
    b.skills = [{ name: "review", files: { "SKILL.md": "# review" } }];
    return b;
  };

  it("round-trips a bundle through encrypt/decrypt", () => {
    const data = encryptBundle(bundle(), "correct horse battery staple");
    expect(isPack(data)).toBe(true);
    const back = decryptBundle(data, "correct horse battery staple", "test");
    expect(back).toEqual(bundle());
  });

  it("produces a fresh salt/iv per pack (no deterministic ciphertext)", () => {
    const a = encryptBundle(bundle(), "pw");
    const b = encryptBundle(bundle(), "pw");
    expect(a.equals(b)).toBe(false);
  });

  it("rejects a wrong passphrase with a data error", () => {
    const data = encryptBundle(bundle(), "right");
    expect(() => decryptBundle(data, "wrong", "test")).toThrowError(CliError);
    expect(() => decryptBundle(data, "wrong", "test")).toThrow(/decryption failed/);
  });

  it("rejects tampered ciphertext", () => {
    const data = encryptBundle(bundle(), "pw");
    data[data.length - 1] ^= 0xff;
    expect(() => decryptBundle(data, "pw", "test")).toThrow(/decryption failed/);
  });

  it("rejects files without the pack magic", () => {
    expect(isPack(Buffer.from("{}"))).toBe(false);
    expect(() => decryptBundle(Buffer.from("not a pack at all, nope"), "pw", "test")).toThrow(
      /not an agentmove pack/,
    );
    expect(() => decryptBundle(PACK_MAGIC, "pw", "test")).toThrow(/not an agentmove pack/);
  });
});
