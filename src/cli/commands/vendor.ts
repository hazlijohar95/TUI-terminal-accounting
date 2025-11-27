import {
  getVendors,
  getVendor,
  saveVendor,
  deleteVendor,
} from "../../core/storage/index.js";
import { generateId, timestamp, type Vendor } from "../../core/models/index.js";
import {
  printTitle,
  printSuccess,
  printError,
  printKeyValue,
  printDim,
  printBullet,
} from "../ui.js";

// Parse command line arguments
function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      result[key] = value;
      if (value !== "true") i++;
    }
  }
  return result;
}

// Add a vendor
export function addVendor(args: string[]): void {
  const name = args.find((a) => !a.startsWith("--"));
  const parsed = parseArgs(args);

  if (!name) {
    printError("Missing vendor name");
    printDim("Usage: oa vendor add <name> [--email <email>] [--phone <phone>]");
    return;
  }

  // Check if vendor exists
  const existing = getVendor(name);
  if (existing) {
    printError(`Vendor already exists: ${name}`);
    return;
  }

  const vendor: Vendor = {
    id: generateId(),
    name,
    email: parsed.email,
    phone: parsed.phone,
    address: parsed.address,
    notes: parsed.notes,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  saveVendor(vendor);
  printSuccess(`Vendor added: ${name}`);
}

// List vendors
export function listVendors(): void {
  const vendors = getVendors();

  if (vendors.length === 0) {
    printDim("No vendors found. Add one with: oa vendor add <name>");
    return;
  }

  printTitle("Vendors");
  console.log();

  for (const vendor of vendors) {
    console.log(`  ${vendor.name}`);
    if (vendor.email) {
      printDim(`    ${vendor.email}`);
    }
  }
  console.log();
  printDim(`${vendors.length} vendor(s)`);
}

// View vendor
export function viewVendor(id: string): void {
  const vendor = getVendor(id);

  if (!vendor) {
    printError(`Vendor not found: ${id}`);
    return;
  }

  printTitle(vendor.name);
  console.log();

  if (vendor.email) printKeyValue("Email", vendor.email);
  if (vendor.phone) printKeyValue("Phone", vendor.phone);
  if (vendor.address) printKeyValue("Address", vendor.address);
  if (vendor.notes) printKeyValue("Notes", vendor.notes);
  printKeyValue("Added", vendor.createdAt.split("T")[0]);
}

// Remove vendor
export function removeVendor(id: string): void {
  const vendor = getVendor(id);

  if (!vendor) {
    printError(`Vendor not found: ${id}`);
    return;
  }

  deleteVendor(vendor.id);
  printSuccess(`Vendor removed: ${vendor.name}`);
}

// Main vendor command router
export function vendorCommand(args: string[]): void {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      addVendor(subArgs);
      break;
    case "list":
      listVendors();
      break;
    case "view":
      if (!subArgs[0]) {
        printError("Missing vendor name");
        return;
      }
      viewVendor(subArgs[0]);
      break;
    case "remove":
      if (!subArgs[0]) {
        printError("Missing vendor name");
        return;
      }
      removeVendor(subArgs[0]);
      break;
    default:
      printError(`Unknown vendor command: ${subcommand || "(none)"}`);
      console.log();
      printDim("Available commands:");
      printBullet("add     - Add new vendor");
      printBullet("list    - List all vendors");
      printBullet("view    - View vendor details");
      printBullet("remove  - Remove vendor");
  }
}
