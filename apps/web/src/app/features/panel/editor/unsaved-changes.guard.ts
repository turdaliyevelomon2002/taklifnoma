import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { PanelConfirm } from '../ui/confirm.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Saqlanmagan o'zgarishlar bo'lsa, chiqib ketishdan oldin so'raymiz. */
export async function confirmDiscard(confirm: PanelConfirm): Promise<boolean> {
  return confirm.ask({
    title: 'panel.editor.leaveTitle',
    message: 'panel.editor.leaveText',
    confirm: 'panel.editor.leaveConfirm',
    cancel: 'panel.editor.leaveCancel',
    danger: true,
  });
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || confirmDiscard(inject(PanelConfirm));
