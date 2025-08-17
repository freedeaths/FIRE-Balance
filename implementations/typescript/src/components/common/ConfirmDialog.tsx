/**
 * ConfirmDialog - 确认对话框组件
 *
 * 提供一致的确认弹窗体验，匹配应用的设计风格
 */

import React from "react";
import { Modal, Text, Group, Button, Stack, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconTrash, IconRefresh } from "@tabler/icons-react";

interface ConfirmDialogProps {
  /** 是否显示弹窗 */
  opened: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm: () => void;
  /** 弹窗标题 */
  title: string;
  /** 弹窗内容 */
  message: string;
  /** 确认按钮文字 */
  confirmLabel?: string;
  /** 取消按钮文字 */
  cancelLabel?: string;
  /** 确认按钮颜色 */
  confirmColor?: string;
  /** 图标类型 */
  iconType?: "warning" | "delete" | "refresh";
  /** 是否正在处理中 */
  loading?: boolean;
}

export function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "red",
  iconType = "warning",
  loading = false,
}: ConfirmDialogProps): React.JSX.Element {
  // 图标映射
  const getIcon = () => {
    switch (iconType) {
      case "delete":
        return <IconTrash size={24} />;
      case "refresh":
        return <IconRefresh size={24} />;
      case "warning":
      default:
        return <IconAlertTriangle size={24} />;
    }
  };

  // 图标颜色映射
  const getIconColor = () => {
    switch (iconType) {
      case "delete":
        return "red";
      case "refresh":
        return "blue";
      case "warning":
      default:
        return "orange";
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="sm"
      withCloseButton={false}
      styles={{
        body: {
          padding: "24px",
        },
        header: {
          paddingBottom: "16px",
        },
        title: {
          fontSize: "18px",
          fontWeight: 600,
        },
      }}
    >
      <Stack gap="lg">
        {/* 图标和消息 */}
        <Group gap="md" align="flex-start">
          <ThemeIcon
            size="lg"
            color={getIconColor()}
            variant="light"
            style={{ flexShrink: 0, marginTop: "2px" }}
          >
            {getIcon()}
          </ThemeIcon>

          <Text size="sm" style={{ flex: 1, lineHeight: 1.5 }}>
            {message}
          </Text>
        </Group>

        {/* 按钮组 */}
        <Group justify="flex-end" gap="sm">
          <Button
            variant="subtle"
            onClick={onClose}
            disabled={loading}
            size="sm"
          >
            {cancelLabel}
          </Button>

          <Button
            color={confirmColor}
            onClick={handleConfirm}
            loading={loading}
            size="sm"
            autoFocus
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmDialog;
