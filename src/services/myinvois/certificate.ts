/**
 * Certificate Management Module
 *
 * Handles PKCS#12 certificate loading and expiry checking
 * for LHDN e-invoice digital signing.
 */

import { readFileSync, existsSync } from "fs";
import * as forge from "node-forge";
import { getLHDNSettings } from "../../db/index.js";

export interface CertificateInfo {
  valid: boolean;
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  validFrom?: Date;
  validTo?: Date;
  daysUntilExpiry?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;  // Within 30 days
  error?: string;
}

export interface CertificateWarning {
  level: "info" | "warning" | "error";
  message: string;
  daysUntilExpiry?: number;
}

/**
 * Load and parse a PKCS#12 certificate
 */
export function loadCertificate(
  certPath: string,
  password: string
): CertificateInfo {
  try {
    if (!existsSync(certPath)) {
      return { valid: false, error: "Certificate file not found" };
    }

    const p12Buffer = readFileSync(certPath);
    const p12Base64 = p12Buffer.toString("binary");
    const p12Asn1 = forge.asn1.fromDer(p12Base64);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Get certificate bags
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];

    if (!certBag || certBag.length === 0) {
      return { valid: false, error: "No certificate found in PKCS#12 file" };
    }

    const cert = certBag[0].cert;
    if (!cert) {
      return { valid: false, error: "Invalid certificate in PKCS#12 file" };
    }

    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      valid: true,
      subject: cert.subject.getField("CN")?.value || "Unknown",
      issuer: cert.issuer.getField("CN")?.value || "Unknown",
      serialNumber: cert.serialNumber,
      validFrom,
      validTo,
      daysUntilExpiry,
      isExpired: now > validTo,
      isExpiringSoon: daysUntilExpiry <= 30 && daysUntilExpiry > 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Invalid password")) {
      return { valid: false, error: "Invalid certificate password" };
    }
    return { valid: false, error: `Failed to load certificate: ${message}` };
  }
}

/**
 * Get certificate info from LHDN settings
 */
export function getCertificateInfo(): CertificateInfo {
  const settings = getLHDNSettings();

  if (!settings) {
    return { valid: false, error: "LHDN settings not configured" };
  }

  if (!settings.certificatePath) {
    return { valid: false, error: "Certificate path not configured" };
  }

  if (!settings.certificatePassword) {
    return { valid: false, error: "Certificate password not configured" };
  }

  return loadCertificate(settings.certificatePath, settings.certificatePassword);
}

/**
 * Get certificate warnings if any
 */
export function getCertificateWarnings(): CertificateWarning[] {
  const warnings: CertificateWarning[] = [];
  const certInfo = getCertificateInfo();

  if (!certInfo.valid) {
    warnings.push({
      level: "error",
      message: certInfo.error || "Certificate not valid",
    });
    return warnings;
  }

  if (certInfo.isExpired) {
    warnings.push({
      level: "error",
      message: "Digital signing certificate has expired",
      daysUntilExpiry: certInfo.daysUntilExpiry,
    });
  } else if (certInfo.isExpiringSoon) {
    warnings.push({
      level: "warning",
      message: `Certificate expires in ${certInfo.daysUntilExpiry} days`,
      daysUntilExpiry: certInfo.daysUntilExpiry,
    });
  } else if (certInfo.daysUntilExpiry && certInfo.daysUntilExpiry <= 60) {
    warnings.push({
      level: "info",
      message: `Certificate expires in ${certInfo.daysUntilExpiry} days`,
      daysUntilExpiry: certInfo.daysUntilExpiry,
    });
  }

  return warnings;
}

/**
 * Check if certificate is valid for signing
 */
export function isCertificateValidForSigning(): {
  valid: boolean;
  reason?: string;
} {
  const certInfo = getCertificateInfo();

  if (!certInfo.valid) {
    return { valid: false, reason: certInfo.error };
  }

  if (certInfo.isExpired) {
    return { valid: false, reason: "Certificate has expired" };
  }

  return { valid: true };
}

/**
 * Format certificate info for display
 */
export function formatCertificateInfo(info: CertificateInfo): string {
  if (!info.valid) {
    return `Certificate Error: ${info.error}`;
  }

  const lines: string[] = [];
  lines.push(`Subject: ${info.subject}`);
  lines.push(`Issuer: ${info.issuer}`);
  lines.push(`Valid From: ${info.validFrom?.toLocaleDateString()}`);
  lines.push(`Valid To: ${info.validTo?.toLocaleDateString()}`);

  if (info.isExpired) {
    lines.push(`Status: EXPIRED`);
  } else if (info.isExpiringSoon) {
    lines.push(`Status: Expiring in ${info.daysUntilExpiry} days`);
  } else {
    lines.push(`Status: Valid (${info.daysUntilExpiry} days remaining)`);
  }

  return lines.join("\n");
}
