import React from "react";
import { Box, Text } from "ink";
import { colors } from "../themes/colors.js";

type FileListProps = {
  files: string[];
  selectedIndex?: number;
};

export function FileList({ files, selectedIndex = -1 }: FileListProps) {
  if (files.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={colors.textDimmed}>No files</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {files.map((file, index) => (
        <Box key={file}>
          <Text
            color={index === selectedIndex ? colors.primary : colors.text}
            bold={index === selectedIndex}
          >
            {index === selectedIndex ? "▶ " : "  "}
            {file}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
