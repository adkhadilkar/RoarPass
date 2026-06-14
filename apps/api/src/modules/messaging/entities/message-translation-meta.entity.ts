import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('message_translation_meta')
@Index(['messageId'])
export class MessageTranslationMeta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @ManyToOne(() => Message, (m) => m.translationMetas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column({ type: 'varchar', length: 10, nullable: true })
  detectedLanguage: string | null;

  @Column({ type: 'float', nullable: true })
  detectionConfidence: number | null;

  @Column({ type: 'boolean', default: false })
  isOfficial: boolean;

  @CreateDateColumn()
  detectedAt: Date;
}