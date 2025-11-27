/**
 * DocumentsView Component
 *
 * Document vault with visual categorization, summary stats,
 * and btop-inspired design elements.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { listDocuments, createDocument, deleteDocument, updateDocumentType } from "../../domain/documents.js";
import { exec } from "child_process";
import { existsSync } from "fs";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";

interface DocumentsViewProps {
  width: number;
  height: number;
}

type FocusArea = "list" | "form";
type FormField = "path" | "type" | "notes";
type DocType = "receipt" | "invoice" | "statement" | "contract" | "other";

const docTypes: DocType[] = ["receipt", "invoice", "statement", "contract", "other"];

export function DocumentsView({ width, height }: DocumentsViewProps) {
  const theme = getEnhancedTheme();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea>("list");
  const [activeField, setActiveField] = useState<FormField>("path");

  // Form state
  const [filePath, setFilePath] = useState("");
  const [docTypeIndex, setDocTypeIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formFields: FormField[] = ["path", "type", "notes"];
  const listWidth = Math.floor(width * 0.5);
  const formWidth = width - listWidth - 3;

  // Type icons using Unicode
  const typeIcons: Record<string, string> = {
    receipt: "◧",
    invoice: "◨",
    statement: "◩",
    contract: "◪",
    other: "◫",
  };

  const loadData = () => {
    setDocuments(listDocuments({ limit: 100 }));
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFilePath("");
    setDocTypeIndex(0);
    setNotes("");
  };

  const handleSubmit = () => {
    if (!filePath.trim()) {
      setFormMessage({ type: "error", text: "File path required" });
      return;
    }

    // Unescape path (terminal escapes spaces and special chars when dragging files)
    const cleanPath = filePath.trim().replace(/\\(.)/g, '$1');

    // Check if file exists
    if (!existsSync(cleanPath)) {
      setFormMessage({ type: "error", text: "File not found" });
      return;
    }

    try {
      createDocument({
        source_path: cleanPath,
        doc_type: docTypes[docTypeIndex],
        notes: notes || undefined,
      });

      setFormMessage({ type: "success", text: "Document added to vault!" });
      resetForm();
      loadData();

      setTimeout(() => setFormMessage(null), 2000);
    } catch (err) {
      setFormMessage({ type: "error", text: (err as Error).message });
    }
  };

  const handleOpen = () => {
    if (documents.length === 0) return;
    const doc = documents[selectedIndex];

    // Open with system default app
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${cmd} "${doc.file_path}"`, (err) => {
      if (err) {
        setFormMessage({ type: "error", text: "Failed to open file" });
        setTimeout(() => setFormMessage(null), 2000);
      }
    });
  };

  const handleDeleteRequest = () => {
    if (documents.length === 0) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (documents.length === 0) return;
    const doc = documents[selectedIndex];

    deleteDocument(doc.id);
    setFormMessage({ type: "success", text: "Document deleted" });
    setShowDeleteConfirm(false);
    loadData();

    if (selectedIndex >= documents.length - 1) {
      setSelectedIndex(Math.max(0, documents.length - 2));
    }

    setTimeout(() => setFormMessage(null), 2000);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  useInput((input, key) => {
    // Handle delete confirmation dialog
    if (showDeleteConfirm) {
      if (input === "y" || input === "Y") {
        handleDeleteConfirm();
      } else if (input === "n" || input === "N" || key.escape) {
        handleDeleteCancel();
      }
      return;
    }

    // Tab to switch between list and form
    if (key.tab) {
      setFocusArea((prev) => (prev === "list" ? "form" : "list"));
      return;
    }

    if (focusArea === "list") {
      // List navigation
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === "j") {
        setSelectedIndex((prev) => Math.min(documents.length - 1, prev + 1));
      }
      // Open document
      if (input === "o") {
        handleOpen();
      }
      // Delete document - show confirmation
      if (input === "x" && key.ctrl) {
        handleDeleteRequest();
      }
      // Add new
      if (input === "n" || key.return) {
        setFocusArea("form");
        setActiveField("path");
      }
    } else {
      // Form input handling
      if (key.upArrow) {
        const idx = formFields.indexOf(activeField);
        if (idx > 0) setActiveField(formFields[idx - 1]);
        return;
      }
      if (key.downArrow) {
        const idx = formFields.indexOf(activeField);
        if (idx < formFields.length - 1) setActiveField(formFields[idx + 1]);
        return;
      }

      // Type selection with left/right arrows
      if (activeField === "type") {
        if (key.leftArrow) {
          setDocTypeIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.rightArrow) {
          setDocTypeIndex((prev) => Math.min(docTypes.length - 1, prev + 1));
          return;
        }
      }

      // Ctrl+S to submit
      if (input === "s" && key.ctrl) {
        handleSubmit();
        return;
      }

      if (key.return) {
        const idx = formFields.indexOf(activeField);
        if (idx < formFields.length - 1) {
          setActiveField(formFields[idx + 1]);
        } else {
          handleSubmit();
        }
        return;
      }

      if (key.backspace || key.delete) {
        switch (activeField) {
          case "path":
            setFilePath((prev) => prev.slice(0, -1));
            break;
          case "notes":
            setNotes((prev) => prev.slice(0, -1));
            break;
        }
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta && !key.escape) {
        switch (activeField) {
          case "path":
            setFilePath((prev) => prev + input);
            break;
          case "notes":
            setNotes((prev) => prev + input);
            break;
        }
      }
    }
  });

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Get type icon
  const getTypeIcon = (type: string | null): string => {
    return typeIcons[type || "other"] || typeIcons.other;
  };

  // Calculate document stats
  const linkedCount = documents.filter((d) => d.expense_id || d.invoice_id).length;
  const totalSize = documents.reduce((sum, d) => sum + (d.file_size || 0), 0);

  // Type breakdown for summary
  const typeCounts = documents.reduce((acc, doc) => {
    const type = doc.doc_type || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Documents List */}
      <Box
        flexDirection="column"
        width={listWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={focusArea === "list" ? theme.semantic.focusBorder : theme.semantic.border}
        paddingX={1}
      >
        {/* Header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.warning}>◆ Document Vault</Text>
          <Text color={theme.semantic.textMuted}>{documents.length} files</Text>
        </Box>

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>j/k ↕ • o open • ^X del • n add</Text>
        </Box>

        {/* Document Stats Summary */}
        {documents.length > 0 && (
          <Box marginBottom={1}>
            <Text color={theme.semantic.textMuted}>
              {indicators.check} {linkedCount} linked • {formatSize(totalSize)} total
            </Text>
          </Box>
        )}

        {documents.length === 0 ? (
          <Box marginTop={1}>
            <Text color={theme.semantic.textMuted}>{indicators.info} No documents. Press 'n' to add.</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {documents.slice(0, height - 10).map((doc, i) => {
              const isSelected = i === selectedIndex;
              const isLinked = doc.expense_id || doc.invoice_id;

              if (isSelected) {
                return (
                  <Box key={doc.id}>
                    <Box backgroundColor={theme.semantic.focusBorder}>
                      <Text color={theme.base} bold>
                        {" ▶ "}{getTypeIcon(doc.doc_type)} {doc.original_name.slice(0, 20)}{" "}
                      </Text>
                    </Box>
                    <Text color={isLinked ? theme.semantic.success : theme.semantic.textMuted}>
                      {" "}{isLinked ? indicators.check : indicators.pending}
                    </Text>
                  </Box>
                );
              }

              return (
                <Box key={doc.id}>
                  <Text color={theme.semantic.textSecondary}>
                    {"   "}{getTypeIcon(doc.doc_type)} {doc.original_name.slice(0, 20)}
                  </Text>
                  <Text color={isLinked ? theme.semantic.success : theme.semantic.textMuted}>
                    {" "}{isLinked ? indicators.check : indicators.pending}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        <Box flexGrow={1} />

        {/* Selected document details */}
        {documents.length > 0 && documents[selectedIndex] && (
          <Box
            flexDirection="column"
            borderStyle={borderStyles.input}
            borderColor={theme.semantic.border}
            paddingX={1}
            marginTop={1}
          >
            <Box justifyContent="space-between">
              <Text color={theme.semantic.warning}>
                {documents[selectedIndex].doc_type || "other"}
              </Text>
              <Text color={theme.semantic.textMuted}>
                {documents[selectedIndex].created_at.slice(0, 10)}
              </Text>
            </Box>
            <Box>
              {documents[selectedIndex].expense_id ? (
                <Text color={theme.semantic.success}>
                  {indicators.check} Expense #{documents[selectedIndex].expense_id}
                </Text>
              ) : documents[selectedIndex].invoice_id ? (
                <Text color={theme.semantic.success}>
                  {indicators.check} Invoice #{documents[selectedIndex].invoice_id}
                </Text>
              ) : (
                <Text color={theme.semantic.textMuted}>{indicators.pending} Not linked</Text>
              )}
            </Box>
            {documents[selectedIndex].notes && (
              <Text color={theme.semantic.textMuted}>{documents[selectedIndex].notes.slice(0, 35)}</Text>
            )}
            <Text color={theme.semantic.textMuted}>
              {formatSize(documents[selectedIndex].file_size)}
            </Text>
          </Box>
        )}
      </Box>

      <Box width={1} />

      {/* Right Panel - Add Document Form */}
      <Box
        flexDirection="column"
        width={formWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={focusArea === "form" ? theme.semantic.focusBorder : theme.semantic.border}
        paddingX={1}
      >
        {/* Header */}
        <Box marginBottom={1}>
          <Text bold color={theme.semantic.info}>{indicators.pointer} Add Document</Text>
        </Box>

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(formWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>↑↓ fields • ^S save • Tab switch</Text>
        </Box>

        {/* File Path */}
        <Box marginTop={1} flexDirection="column">
          <Text color={activeField === "path" ? theme.semantic.info : theme.semantic.textMuted}>
            {activeField === "path" ? indicators.pointer : indicators.bullet} File Path:
          </Text>
          <Box
            borderStyle={borderStyles.input}
            borderColor={activeField === "path" ? theme.semantic.focusBorder : theme.semantic.border}
            paddingX={1}
            marginTop={1}
          >
            <Text color={filePath ? theme.semantic.textPrimary : theme.semantic.textMuted}>
              {filePath || "/path/to/file"}
            </Text>
            {activeField === "path" && focusArea === "form" && (
              <Text backgroundColor={theme.semantic.focusBorder}> </Text>
            )}
          </Box>
        </Box>

        {/* Document Type */}
        <Box marginTop={1} flexDirection="column">
          <Text color={activeField === "type" ? theme.semantic.info : theme.semantic.textMuted}>
            {activeField === "type" ? indicators.pointer : indicators.bullet} Type:
          </Text>
          <Box marginTop={1}>
            <Text color={theme.semantic.warning}>
              {indicators.arrowLeft} {typeIcons[docTypes[docTypeIndex]]} {docTypes[docTypeIndex]} {indicators.arrowRight}
            </Text>
          </Box>
        </Box>

        {/* Notes */}
        <Box marginTop={1} flexDirection="column">
          <Text color={activeField === "notes" ? theme.semantic.info : theme.semantic.textMuted}>
            {activeField === "notes" ? indicators.pointer : indicators.bullet} Notes:
          </Text>
          <Box
            borderStyle={borderStyles.input}
            borderColor={activeField === "notes" ? theme.semantic.focusBorder : theme.semantic.border}
            paddingX={1}
            marginTop={1}
          >
            <Text color={notes ? theme.semantic.textPrimary : theme.semantic.textMuted}>
              {notes || "(optional)"}
            </Text>
            {activeField === "notes" && focusArea === "form" && (
              <Text backgroundColor={theme.semantic.focusBorder}> </Text>
            )}
          </Box>
        </Box>

        <Box flexGrow={1} />

        {/* Tips */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.semantic.textSecondary}>{indicators.info} Tips</Text>
          <Box paddingLeft={1} flexDirection="column">
            <Text color={theme.semantic.textMuted}>{indicators.bullet} Drag file to terminal to paste path</Text>
            <Text color={theme.semantic.textMuted}>{indicators.bullet} Supported: PDF, images, CSV, Excel</Text>
          </Box>
        </Box>

        {/* Delete Confirmation */}
        {showDeleteConfirm && documents[selectedIndex] && (
          <Box
            borderStyle={borderStyles.panel}
            borderColor={theme.semantic.error}
            paddingX={1}
            flexDirection="column"
          >
            <Text bold color={theme.semantic.error}>{indicators.warning} Delete Document?</Text>
            <Text color={theme.semantic.textPrimary}>{documents[selectedIndex].original_name}</Text>
            <Box marginTop={1}>
              <Text color={theme.semantic.success}>[Y] Yes</Text>
              <Text> </Text>
              <Text color={theme.semantic.textMuted}>[N] No</Text>
            </Box>
          </Box>
        )}

        {/* Form Message */}
        {formMessage && !showDeleteConfirm && (
          <Box
            borderStyle={borderStyles.input}
            borderColor={formMessage.type === "success" ? theme.semantic.success : theme.semantic.error}
            paddingX={1}
          >
            <Text color={formMessage.type === "success" ? theme.semantic.success : theme.semantic.error}>
              {formMessage.type === "success" ? indicators.check : indicators.cross} {formMessage.text}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
