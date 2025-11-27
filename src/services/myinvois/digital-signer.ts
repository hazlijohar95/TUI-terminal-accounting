/**
 * LHDN Digital Signer
 *
 * Handles digital signing of e-invoice documents using LHDN-issued certificates.
 * Uses node-forge for PKI operations.
 *
 * Requirements:
 * - PKCS#12 (.p12/.pfx) certificate from LHDN
 * - SHA-256 hash of document
 * - RSA-SHA256 signature
 */

import * as forge from "node-forge";
import * as fs from "fs";
import * as crypto from "crypto";
import type { SigningResult } from "./types.js";

interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  publicKey: string;
}

interface SignerConfig {
  certificatePath?: string;
  certificateBuffer?: Buffer;
  password: string;
}

/**
 * Digital Signer for LHDN e-Invoices
 */
export class DigitalSigner {
  private privateKey: forge.pki.rsa.PrivateKey | null = null;
  private certificate: forge.pki.Certificate | null = null;
  private certificateChain: forge.pki.Certificate[] = [];
  private isInitialized = false;

  /**
   * Initialize the signer with a PKCS#12 certificate
   */
  async initialize(config: SignerConfig): Promise<void> {
    try {
      let p12Buffer: Buffer;

      if (config.certificateBuffer) {
        p12Buffer = config.certificateBuffer;
      } else if (config.certificatePath) {
        p12Buffer = fs.readFileSync(config.certificatePath);
      } else {
        throw new SigningError("No certificate provided");
      }

      // Convert buffer to forge-compatible format
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.password);

      // Extract private key
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

      if (!keyBag || keyBag.length === 0) {
        throw new SigningError("No private key found in certificate");
      }

      this.privateKey = keyBag[0].key as forge.pki.rsa.PrivateKey;

      // Extract certificate
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];

      if (!certBag || certBag.length === 0) {
        throw new SigningError("No certificate found in P12 file");
      }

      // First cert is usually the end-entity cert
      this.certificate = certBag[0].cert as forge.pki.Certificate;

      // Store certificate chain for validation
      this.certificateChain = certBag
        .filter((bag) => bag.cert)
        .map((bag) => bag.cert as forge.pki.Certificate);

      this.isInitialized = true;
    } catch (error) {
      if (error instanceof SigningError) {
        throw error;
      }
      throw new SigningError(
        `Failed to load certificate: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Ensure signer is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.privateKey || !this.certificate) {
      throw new SigningError("Signer not initialized. Call initialize() first.");
    }
  }

  /**
   * Create SHA-256 hash of document
   */
  createHash(document: string): string {
    const hash = crypto.createHash("sha256");
    hash.update(document, "utf8");
    return hash.digest("base64");
  }

  /**
   * Create RSA-SHA256 digital signature
   */
  sign(document: string): string {
    this.ensureInitialized();

    // Create SHA-256 hash
    const md = forge.md.sha256.create();
    md.update(document, "utf8");

    // Sign the hash
    const signature = this.privateKey!.sign(md);

    // Return base64 encoded signature
    return forge.util.encode64(signature);
  }

  /**
   * Sign document and return complete signing result
   */
  signDocument(document: string): SigningResult {
    this.ensureInitialized();

    const hash = this.createHash(document);
    const signature = this.sign(document);
    const certificate = this.getCertificatePem();

    return {
      hash,
      signature,
      certificate,
    };
  }

  /**
   * Get certificate in PEM format
   */
  getCertificatePem(): string {
    this.ensureInitialized();
    return forge.pki.certificateToPem(this.certificate!);
  }

  /**
   * Get certificate in DER format (base64)
   */
  getCertificateDer(): string {
    this.ensureInitialized();
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(this.certificate!));
    return forge.util.encode64(der.getBytes());
  }

  /**
   * Get certificate info for display
   */
  getCertificateInfo(): CertificateInfo {
    this.ensureInitialized();

    const cert = this.certificate!;

    return {
      subject: cert.subject.attributes
        .map((attr) => `${attr.shortName}=${attr.value}`)
        .join(", "),
      issuer: cert.issuer.attributes
        .map((attr) => `${attr.shortName}=${attr.value}`)
        .join(", "),
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      publicKey: forge.pki.publicKeyToPem(cert.publicKey),
    };
  }

  /**
   * Verify the certificate is still valid
   */
  isCertificateValid(): boolean {
    this.ensureInitialized();

    const now = new Date();
    const cert = this.certificate!;

    return now >= cert.validity.notBefore && now <= cert.validity.notAfter;
  }

  /**
   * Get days until certificate expiry
   */
  getDaysUntilExpiry(): number {
    this.ensureInitialized();

    const now = new Date();
    const expiry = this.certificate!.validity.notAfter;
    const diffMs = expiry.getTime() - now.getTime();

    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Verify a signature (for testing/validation)
   */
  verifySignature(document: string, signatureBase64: string): boolean {
    this.ensureInitialized();

    try {
      const md = forge.md.sha256.create();
      md.update(document, "utf8");

      const signature = forge.util.decode64(signatureBase64);
      const publicKey = this.certificate!.publicKey as forge.pki.rsa.PublicKey;

      return publicKey.verify(md.digest().bytes(), signature);
    } catch {
      return false;
    }
  }

  /**
   * Get X.509 certificate fields for UBL signature
   */
  getX509Data(): {
    x509Certificate: string;
    x509IssuerName: string;
    x509SerialNumber: string;
  } {
    this.ensureInitialized();

    const cert = this.certificate!;

    return {
      x509Certificate: this.getCertificateDer(),
      x509IssuerName: cert.issuer.attributes
        .map((attr) => `${attr.shortName}=${attr.value}`)
        .join(", "),
      x509SerialNumber: cert.serialNumber,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.privateKey = null;
    this.certificate = null;
    this.certificateChain = [];
    this.isInitialized = false;
  }
}

/**
 * Custom error class for signing-related errors
 */
export class SigningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SigningError";
  }
}

/**
 * Create and initialize a signer instance
 */
export async function createSigner(config: SignerConfig): Promise<DigitalSigner> {
  const signer = new DigitalSigner();
  await signer.initialize(config);
  return signer;
}

/**
 * Singleton signer instance for reuse
 */
let signerInstance: DigitalSigner | null = null;

export async function initializeSigner(config: SignerConfig): Promise<DigitalSigner> {
  if (signerInstance) {
    signerInstance.dispose();
  }
  signerInstance = new DigitalSigner();
  await signerInstance.initialize(config);
  return signerInstance;
}

export function getSigner(): DigitalSigner {
  if (!signerInstance) {
    throw new SigningError("Signer not initialized. Call initializeSigner() first.");
  }
  return signerInstance;
}
