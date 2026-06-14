import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { VoiceNoteStatus } from '@roarpass/shared';
import { Message } from './message.entity';

@Entity('voice_notes')
export class VoiceNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  messageId: string;

  @OneToOne(() => Message, (m) => m.voiceNote, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column({ type: 'varchar', length: 500 })
  audioUrl: string;

  @Column({ type: 'float' })
  durationSeconds: number;

  @Column({ type: 'jsonb', default: '[]' })
  waveformData: number[];

  @Column({ type: 'text', nullable: true })
  transcription: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  transcriptionLanguage: string | null;

  @Column({ type: 'enum', enum: VoiceNoteStatus, default: VoiceNoteStatus.PROCESSING })
  status: VoiceNoteStatus;

  @CreateDateColumn()
  createdAt: Date;
}