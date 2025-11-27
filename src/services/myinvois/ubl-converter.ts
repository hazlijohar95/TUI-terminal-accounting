/**
 * UBL 2.1 Converter for LHDN e-Invoicing
 *
 * Converts invoice data to LHDN-compliant UBL 2.1 JSON format.
 * Based on LHDN e-Invoice SDK guidelines v4.0
 */

import {
  UBL_NAMESPACES,
  UBL_CREDIT_NOTE_NAMESPACE,
  UBL_DEBIT_NOTE_NAMESPACE,
  DEFAULTS,
} from "./constants.js";
import type {
  EInvoiceDocument,
  LHDNSupplier,
  LHDNBuyer,
  LHDNLineItem,
  DocumentType,
} from "./types.js";

type UBLValue = string | number | boolean | UBLObject | UBLArray;
type UBLArray = UBLValue[];
interface UBLObject {
  [key: string]: UBLValue | undefined;
}

// UBL Namespace types
interface UBLNamespace {
  _D: string;
  _A: string;
  _B: string;
}

/**
 * Convert amount from cents to decimal string (2 decimal places)
 */
function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Convert amount from cents to number (for UBL)
 */
function centsToDecimal(cents: number): number {
  return cents / 100;
}

/**
 * Get UBL namespace based on document type
 */
function getNamespace(documentType: DocumentType): UBLNamespace {
  if (documentType === "02" || documentType === "12") {
    return { ...UBL_NAMESPACES, ...UBL_CREDIT_NOTE_NAMESPACE };
  }
  if (documentType === "03" || documentType === "13") {
    return { ...UBL_NAMESPACES, ...UBL_DEBIT_NOTE_NAMESPACE };
  }
  return { ...UBL_NAMESPACES };
}

/**
 * Get document type name for UBL
 */
function getDocumentTypeName(documentType: DocumentType): string {
  const names: Record<DocumentType, string> = {
    "01": "Invoice",
    "02": "CreditNote",
    "03": "DebitNote",
    "11": "Invoice", // Self-billed uses same structure
    "12": "CreditNote",
    "13": "DebitNote",
  };
  return names[documentType];
}

/**
 * Build address block for UBL
 */
function buildAddress(
  addressLine1: string,
  addressLine2: string | undefined,
  addressLine3: string | undefined,
  city: string,
  postalCode: string,
  state: string,
  country: string
): UBLObject {
  const addressLines: UBLObject[] = [
    { "cbc:Line": [{ _: addressLine1 }] },
  ];

  if (addressLine2) {
    addressLines.push({ "cbc:Line": [{ _: addressLine2 }] });
  }
  if (addressLine3) {
    addressLines.push({ "cbc:Line": [{ _: addressLine3 }] });
  }

  return {
    "cbc:CityName": [{ _: city }],
    "cbc:PostalZone": [{ _: postalCode }],
    "cbc:CountrySubentityCode": [{ _: state }],
    "cac:AddressLine": addressLines,
    "cac:Country": [
      {
        "cbc:IdentificationCode": [
          { _: country, listID: "ISO3166-1", listAgencyID: "6" },
        ],
      },
    ],
  };
}

/**
 * Build supplier (AccountingSupplierParty) block
 */
function buildSupplierParty(supplier: LHDNSupplier): UBLObject {
  const partyIdentifications: UBLObject[] = [
    {
      "cbc:ID": [{ _: supplier.tin, schemeID: "TIN" }],
    },
  ];

  if (supplier.brn) {
    partyIdentifications.push({
      "cbc:ID": [{ _: supplier.brn, schemeID: "BRN" }],
    });
  }

  if (supplier.sstRegistration) {
    partyIdentifications.push({
      "cbc:ID": [{ _: supplier.sstRegistration, schemeID: "SST" }],
    });
  }

  if (supplier.tourismTaxRegistration) {
    partyIdentifications.push({
      "cbc:ID": [{ _: supplier.tourismTaxRegistration, schemeID: "TTX" }],
    });
  }

  const contact: UBLObject = {};
  if (supplier.phone) {
    contact["cbc:Telephone"] = [{ _: supplier.phone }];
  }
  if (supplier.email) {
    contact["cbc:ElectronicMail"] = [{ _: supplier.email }];
  }

  return {
    "cac:Party": [
      {
        "cbc:IndustryClassificationCode": [
          { _: supplier.msicCode, name: supplier.businessActivityDescription },
        ],
        "cac:PartyIdentification": partyIdentifications,
        "cac:PostalAddress": [
          buildAddress(
            supplier.address.addressLine1,
            supplier.address.addressLine2,
            supplier.address.addressLine3,
            supplier.address.city,
            supplier.address.postalCode,
            supplier.address.state,
            supplier.address.country
          ),
        ],
        "cac:PartyLegalEntity": [
          {
            "cbc:RegistrationName": [{ _: supplier.name }],
          },
        ],
        ...(Object.keys(contact).length > 0
          ? { "cac:Contact": [contact] }
          : {}),
      },
    ],
  };
}

/**
 * Build buyer (AccountingCustomerParty) block
 */
function buildBuyerParty(buyer: LHDNBuyer): UBLObject {
  const partyIdentifications: UBLObject[] = [];

  if (buyer.tin) {
    partyIdentifications.push({
      "cbc:ID": [{ _: buyer.tin, schemeID: "TIN" }],
    });
  }

  if (buyer.brn) {
    partyIdentifications.push({
      "cbc:ID": [{ _: buyer.brn, schemeID: "BRN" }],
    });
  }

  if (buyer.sstRegistration) {
    partyIdentifications.push({
      "cbc:ID": [{ _: buyer.sstRegistration, schemeID: "SST" }],
    });
  }

  // For individuals without TIN/BRN, use ID type
  if (buyer.idType && buyer.idValue) {
    partyIdentifications.push({
      "cbc:ID": [{ _: buyer.idValue, schemeID: buyer.idType }],
    });
  }

  // If no identification, use general public identifier
  if (partyIdentifications.length === 0) {
    partyIdentifications.push({
      "cbc:ID": [{ _: "EI00000000010", schemeID: "TIN" }],
    });
  }

  const contact: UBLObject = {};
  if (buyer.phone) {
    contact["cbc:Telephone"] = [{ _: buyer.phone }];
  }
  if (buyer.email) {
    contact["cbc:ElectronicMail"] = [{ _: buyer.email }];
  }

  return {
    "cac:Party": [
      {
        "cac:PartyIdentification": partyIdentifications,
        "cac:PostalAddress": [
          buildAddress(
            buyer.address.addressLine1,
            buyer.address.addressLine2,
            buyer.address.addressLine3,
            buyer.address.city,
            buyer.address.postalCode,
            buyer.address.state,
            buyer.address.country
          ),
        ],
        "cac:PartyLegalEntity": [
          {
            "cbc:RegistrationName": [{ _: buyer.name }],
          },
        ],
        ...(Object.keys(contact).length > 0
          ? { "cac:Contact": [contact] }
          : {}),
      },
    ],
  };
}

/**
 * Build invoice line item
 */
function buildInvoiceLine(item: LHDNLineItem, index: number): UBLObject {
  const line: UBLObject = {
    "cbc:ID": [{ _: String(item.id || index + 1) }],
    "cbc:InvoicedQuantity": [
      { _: item.quantity, unitCode: item.unitCode || DEFAULTS.UNIT_CODE },
    ],
    "cbc:LineExtensionAmount": [
      { _: centsToDecimal(item.totalExclTax), currencyID: "MYR" },
    ],
    "cac:TaxTotal": [
      {
        "cbc:TaxAmount": [
          { _: centsToDecimal(item.taxAmount), currencyID: "MYR" },
        ],
        "cac:TaxSubtotal": [
          {
            "cbc:TaxableAmount": [
              { _: centsToDecimal(item.totalExclTax), currencyID: "MYR" },
            ],
            "cbc:TaxAmount": [
              { _: centsToDecimal(item.taxAmount), currencyID: "MYR" },
            ],
            "cac:TaxCategory": [
              {
                "cbc:ID": [{ _: item.taxType }],
                "cbc:Percent": [{ _: item.taxRate }],
                "cac:TaxScheme": [
                  {
                    "cbc:ID": [
                      { _: "OTH", schemeID: "UN/ECE 5153", schemeAgencyID: "6" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    "cac:Item": [
      {
        "cbc:Description": [{ _: item.description }],
        "cac:CommodityClassification": [
          {
            "cbc:ItemClassificationCode": [
              { _: item.classificationCode, listID: "CLASS" },
            ],
          },
        ],
      },
    ],
    "cac:Price": [
      {
        "cbc:PriceAmount": [
          { _: centsToDecimal(item.unitPrice), currencyID: "MYR" },
        ],
      },
    ],
  };

  // Add discount if present
  if (item.discountAmount && item.discountAmount > 0) {
    line["cac:AllowanceCharge"] = [
      {
        "cbc:ChargeIndicator": [{ _: false }],
        "cbc:AllowanceChargeReason": [{ _: "Discount" }],
        "cbc:Amount": [
          { _: centsToDecimal(item.discountAmount), currencyID: "MYR" },
        ],
      },
    ];
  }

  // Add tariff code if present
  if (item.productTariffCode) {
    const itemBlock = line["cac:Item"] as UBLObject[];
    if (itemBlock && itemBlock[0]) {
      (itemBlock[0] as UBLObject)["cac:CommodityClassification"] = [
        {
          "cbc:ItemClassificationCode": [
            { _: item.classificationCode, listID: "CLASS" },
          ],
        },
        {
          "cbc:ItemClassificationCode": [
            { _: item.productTariffCode, listID: "PTC" },
          ],
        },
      ];
    }
  }

  return line;
}

/**
 * Build tax total section
 */
function buildTaxTotal(
  taxAmount: number,
  taxableAmount: number,
  taxType: string,
  taxRate: number
): UBLObject {
  return {
    "cbc:TaxAmount": [{ _: centsToDecimal(taxAmount), currencyID: "MYR" }],
    "cac:TaxSubtotal": [
      {
        "cbc:TaxableAmount": [
          { _: centsToDecimal(taxableAmount), currencyID: "MYR" },
        ],
        "cbc:TaxAmount": [{ _: centsToDecimal(taxAmount), currencyID: "MYR" }],
        "cac:TaxCategory": [
          {
            "cbc:ID": [{ _: taxType }],
            "cbc:Percent": [{ _: taxRate }],
            "cac:TaxScheme": [
              {
                "cbc:ID": [
                  { _: "OTH", schemeID: "UN/ECE 5153", schemeAgencyID: "6" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Build legal monetary total section
 */
function buildLegalMonetaryTotal(doc: EInvoiceDocument): UBLObject {
  const total: UBLObject = {
    "cbc:LineExtensionAmount": [
      { _: centsToDecimal(doc.subtotal), currencyID: doc.documentCurrencyCode },
    ],
    "cbc:TaxExclusiveAmount": [
      { _: centsToDecimal(doc.totalExclTax), currencyID: doc.documentCurrencyCode },
    ],
    "cbc:TaxInclusiveAmount": [
      { _: centsToDecimal(doc.totalInclTax), currencyID: doc.documentCurrencyCode },
    ],
    "cbc:PayableAmount": [
      { _: centsToDecimal(doc.totalPayableAmount), currencyID: doc.documentCurrencyCode },
    ],
  };

  if (doc.totalDiscount > 0) {
    total["cbc:AllowanceTotalAmount"] = [
      { _: centsToDecimal(doc.totalDiscount), currencyID: doc.documentCurrencyCode },
    ];
  }

  if (doc.roundingAmount) {
    total["cbc:PayableRoundingAmount"] = [
      { _: centsToDecimal(doc.roundingAmount), currencyID: doc.documentCurrencyCode },
    ];
  }

  return total;
}

/**
 * Convert EInvoiceDocument to UBL 2.1 JSON format
 */
export function convertToUBL(doc: EInvoiceDocument): UBLObject {
  const namespace = getNamespace(doc.documentType);
  const docTypeName = getDocumentTypeName(doc.documentType);

  // Determine primary tax type and rate from items
  const primaryTaxType = doc.items[0]?.taxType || DEFAULTS.TAX_TYPE;
  const primaryTaxRate = doc.items[0]?.taxRate || DEFAULTS.TAX_RATE;

  const ublDocument: UBLObject = {
    ...namespace,
    "cbc:ID": [{ _: doc.id }],
    "cbc:IssueDate": [{ _: doc.issueDate }],
    "cbc:IssueTime": [{ _: doc.issueTime }],
    "cbc:InvoiceTypeCode": [
      { _: doc.documentType, listVersionID: DEFAULTS.DOCUMENT_VERSION },
    ],
    "cbc:DocumentCurrencyCode": [{ _: doc.documentCurrencyCode }],
  };

  // Add billing period if present
  if (doc.billingPeriodStart && doc.billingPeriodEnd) {
    ublDocument["cac:InvoicePeriod"] = [
      {
        "cbc:StartDate": [{ _: doc.billingPeriodStart }],
        "cbc:EndDate": [{ _: doc.billingPeriodEnd }],
        ...(doc.billingFrequency
          ? { "cbc:Description": [{ _: doc.billingFrequency }] }
          : {}),
      },
    ];
  }

  // Add reference to original invoice for credit/debit notes
  if (doc.originalInvoiceRef && (doc.documentType === "02" || doc.documentType === "03")) {
    ublDocument["cac:BillingReference"] = [
      {
        "cac:InvoiceDocumentReference": [
          {
            "cbc:ID": [{ _: doc.originalInvoiceRef }],
          },
        ],
      },
    ];
  }

  // Add exchange rate for foreign currency
  if (doc.exchangeRate && doc.exchangeRate !== 1 && doc.documentCurrencyCode !== "MYR") {
    ublDocument["cac:TaxExchangeRate"] = [
      {
        "cbc:SourceCurrencyCode": [{ _: doc.documentCurrencyCode }],
        "cbc:TargetCurrencyCode": [{ _: "MYR" }],
        "cbc:CalculationRate": [{ _: doc.exchangeRate }],
      },
    ];
  }

  // Add supplier party
  ublDocument["cac:AccountingSupplierParty"] = [buildSupplierParty(doc.supplier)];

  // Add buyer party
  ublDocument["cac:AccountingCustomerParty"] = [buildBuyerParty(doc.buyer)];

  // Add payment means if present
  if (doc.paymentMode) {
    ublDocument["cac:PaymentMeans"] = [
      {
        "cbc:PaymentMeansCode": [{ _: doc.paymentMode }],
      },
    ];
  }

  // Add payment terms if present
  if (doc.paymentTerms) {
    ublDocument["cac:PaymentTerms"] = [
      {
        "cbc:Note": [{ _: doc.paymentTerms }],
      },
    ];
  }

  // Add tax total
  ublDocument["cac:TaxTotal"] = [
    buildTaxTotal(
      doc.totalTaxAmount,
      doc.totalExclTax,
      primaryTaxType,
      primaryTaxRate
    ),
  ];

  // Add legal monetary total
  ublDocument["cac:LegalMonetaryTotal"] = [buildLegalMonetaryTotal(doc)];

  // Add invoice lines
  ublDocument["cac:InvoiceLine"] = doc.items.map((item, index) =>
    buildInvoiceLine(item, index)
  );

  // Wrap in document type element
  return {
    [docTypeName]: [ublDocument],
  };
}

/**
 * Convert UBL to JSON string for submission
 */
export function ublToJsonString(ubl: UBLObject): string {
  return JSON.stringify(ubl);
}

/**
 * Validate UBL document has required fields
 */
export function validateUBL(ubl: UBLObject): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Get the document type key (Invoice, CreditNote, or DebitNote)
  const docTypeKey = Object.keys(ubl).find((key) =>
    ["Invoice", "CreditNote", "DebitNote"].includes(key)
  );

  if (!docTypeKey) {
    errors.push("Missing document type (Invoice, CreditNote, or DebitNote)");
    return { valid: false, errors };
  }

  const doc = (ubl[docTypeKey] as UBLObject[])?.[0];
  if (!doc) {
    errors.push("Empty document");
    return { valid: false, errors };
  }

  // Check required fields
  const requiredFields = [
    "cbc:ID",
    "cbc:IssueDate",
    "cbc:IssueTime",
    "cbc:InvoiceTypeCode",
    "cbc:DocumentCurrencyCode",
    "cac:AccountingSupplierParty",
    "cac:AccountingCustomerParty",
    "cac:TaxTotal",
    "cac:LegalMonetaryTotal",
    "cac:InvoiceLine",
  ];

  for (const field of requiredFields) {
    if (!doc[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a minimal test invoice for validation
 */
export function createTestInvoice(
  supplier: LHDNSupplier,
  buyer: LHDNBuyer
): EInvoiceDocument {
  return {
    id: "TEST-001",
    issueDate: new Date().toISOString().split("T")[0],
    issueTime: new Date().toISOString().split("T")[1].slice(0, 8) + "Z",
    documentType: "01",
    documentCurrencyCode: "MYR",
    supplier,
    buyer,
    items: [
      {
        id: "1",
        classificationCode: "002",
        description: "Test Service",
        quantity: 1,
        unitCode: "EA",
        unitPrice: 10000, // RM 100.00
        taxType: "E",
        taxRate: 0,
        taxAmount: 0,
        subtotal: 10000,
        totalExclTax: 10000,
        totalInclTax: 10000,
      },
    ],
    subtotal: 10000,
    totalDiscount: 0,
    totalTaxAmount: 0,
    totalExclTax: 10000,
    totalInclTax: 10000,
    totalPayableAmount: 10000,
  };
}
