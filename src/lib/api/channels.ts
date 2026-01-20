import { db, type DBChannel } from '../indexedDB';

export type ApprovedChannel = DBChannel;

export async function getChannels(): Promise<ApprovedChannel[]> {
  const channels = await db.getChannels();
  return channels.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getChannel(channelId: string): Promise<ApprovedChannel | null> {
  return db.getChannelByChannelId(channelId);
}

export async function addChannel(channel: {
  channel_id: string;
  channel_title: string;
  thumbnail_url?: string;
  auto_approve?: boolean;
}): Promise<ApprovedChannel> {
  const newChannel: ApprovedChannel = {
    id: db.generateId(),
    channel_id: channel.channel_id,
    channel_title: channel.channel_title,
    thumbnail_url: channel.thumbnail_url || null,
    auto_approve: channel.auto_approve || false,
    created_at: db.getTimestamp(),
  };
  return db.addChannel(newChannel);
}

export async function updateChannel(
  id: string,
  updates: Partial<Pick<ApprovedChannel, 'channel_title' | 'thumbnail_url' | 'auto_approve'>>
): Promise<void> {
  const channel = await db.getChannelById(id);
  if (channel) {
    if (updates.channel_title !== undefined) channel.channel_title = updates.channel_title;
    if (updates.thumbnail_url !== undefined) channel.thumbnail_url = updates.thumbnail_url;
    if (updates.auto_approve !== undefined) channel.auto_approve = updates.auto_approve;
    await db.updateChannel(channel);
  }
}

export async function deleteChannel(id: string): Promise<void> {
  await db.deleteChannel(id);
}

export async function toggleAutoApprove(id: string, autoApprove: boolean): Promise<void> {
  const channel = await db.getChannelById(id);
  if (channel) {
    channel.auto_approve = autoApprove;
    await db.updateChannel(channel);
  }
}
