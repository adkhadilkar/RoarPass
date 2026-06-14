import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  AddTrustedContactSchema,
  UpdateTrustedContactSchema,
} from '@roarpass/shared/types/safety';
import { TrustedContactService } from '../../services/safety/TrustedContactService';

const trustedContactsRouter = Router();
const svc = new TrustedContactService();

/**
 * GET /safety/trusted-contacts
 */
trustedContactsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const contacts = await svc.listForUser(req.user!.id);
    res.json({ contacts });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /safety/trusted-contacts
 */
trustedContactsRouter.post(
  '/',
  requireAuth,
  validate(AddTrustedContactSchema),
  async (req: Request, res: Response) => {
    try {
      const contact = await svc.add(req.user!.id, req.body);
      res.status(201).json(contact);
    } catch (err: any) {
      if (err.code === 'DUPLICATE_CONTACT') {
        res.status(409).json({ error: 'DUPLICATE_CONTACT' });
      } else if (err.code === 'MAX_CONTACTS_REACHED') {
        res.status(422).json({ error: 'MAX_CONTACTS_REACHED', max: 10 });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * PATCH /safety/trusted-contacts/:contactId
 */
trustedContactsRouter.patch(
  '/:contactId',
  requireAuth,
  validate(UpdateTrustedContactSchema),
  async (req: Request, res: Response) => {
    try {
      const contact = await svc.update(req.user!.id, req.params.contactId, req.body);
      res.json(contact);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'CONTACT_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

/**
 * DELETE /safety/trusted-contacts/:contactId
 */
trustedContactsRouter.delete(
  '/:contactId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      await svc.remove(req.user!.id, req.params.contactId);
      res.status(204).send();
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'CONTACT_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }
  }
);

export { trustedContactsRouter };