import { Router } from 'express';
import { modifierController } from './modifier.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

// ── Modifier Groups ──────────────────────────────────────────────────────────

// GET  /api/v1/modifiers/groups         — list all groups for restaurant
router.get('/groups', authenticate, (req, res, next) => modifierController.getGroups(req, res, next));

// GET  /api/v1/modifiers/groups/:id      — get single group with options
router.get('/groups/:id', authenticate, (req, res, next) => modifierController.getGroup(req, res, next));

// POST /api/v1/modifiers/groups          — create group (optionally with options)
router.post('/groups', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.createGroup(req, res, next));

// PUT  /api/v1/modifiers/groups/:id      — update group
router.put('/groups/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.updateGroup(req, res, next));

// DELETE /api/v1/modifiers/groups/:id    — delete group
router.delete('/groups/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.deleteGroup(req, res, next));

// ── Modifier Options (nested under groups) ────────────────────────────────────

// GET  /api/v1/modifiers/groups/:groupId/options       — list options for a group
router.get('/groups/:groupId/options', authenticate, (req, res, next) => modifierController.getOptions(req, res, next));

// POST /api/v1/modifiers/groups/:groupId/options        — create option in group
router.post('/groups/:groupId/options', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.createOption(req, res, next));

// PUT  /api/v1/modifiers/options/:id                    — update option
router.put('/options/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.updateOption(req, res, next));

// DELETE /api/v1/modifiers/options/:id                  — delete option
router.delete('/options/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.deleteOption(req, res, next));

// ── Menu Item ↔ Modifier Group junction ──────────────────────────────────────

// GET  /api/v1/modifiers/menu-items/:menuItemId/groups — get modifier groups for a menu item
router.get('/menu-items/:menuItemId/groups', authenticate, (req, res, next) => modifierController.getGroupsForMenuItem(req, res, next));

// POST /api/v1/modifiers/menu-items/:menuItemId/groups — attach modifier groups to menu item
router.post('/menu-items/:menuItemId/groups', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.attachGroups(req, res, next));

// DELETE /api/v1/modifiers/menu-items/:menuItemId/groups/:modifierGroupId — detach group from menu item
router.delete('/menu-items/:menuItemId/groups/:modifierGroupId', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => modifierController.detachGroup(req, res, next));

export default router;