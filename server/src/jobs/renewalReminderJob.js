import { createNotificationRepository } from '../repositories/notificationRepository.js';
import { createReminderService } from '../services/reminderService.js';

export function createRenewalReminderJob({ batchSize, clock, database }) {
  return createReminderService(createNotificationRepository(database), { batchSize, clock });
}
