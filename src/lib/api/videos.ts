import { db, type DBVideo } from '../indexedDB';

export type ApprovedVideo = DBVideo;

export async function getVideos(): Promise<ApprovedVideo[]> {
  const videos = await db.getVideos();
  return videos.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getVideosByChannel(channelId: string): Promise<ApprovedVideo[]> {
  const videos = await db.getVideosByChannelId(channelId);
  return videos.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getVideo(videoId: string): Promise<ApprovedVideo | null> {
  return db.getVideoByVideoId(videoId);
}

export async function addVideo(video: {
  video_id: string;
  title: string;
  channel_id?: string;
  thumbnail_url?: string;
  duration?: string;
}): Promise<ApprovedVideo> {
  const newVideo: ApprovedVideo = {
    id: db.generateId(),
    video_id: video.video_id,
    title: video.title,
    channel_id: video.channel_id || null,
    thumbnail_url: video.thumbnail_url || null,
    duration: video.duration || null,
    created_at: db.getTimestamp(),
  };
  return db.addVideo(newVideo);
}

export async function addVideos(videos: Array<{
  video_id: string;
  title: string;
  channel_id?: string;
  thumbnail_url?: string;
  duration?: string;
}>): Promise<ApprovedVideo[]> {
  const results: ApprovedVideo[] = [];

  for (const video of videos) {
    // Check if video already exists
    const existing = await db.getVideoByVideoId(video.video_id);
    if (existing) {
      // Update existing
      existing.title = video.title;
      existing.channel_id = video.channel_id || existing.channel_id;
      existing.thumbnail_url = video.thumbnail_url || existing.thumbnail_url;
      existing.duration = video.duration || existing.duration;
      await db.updateVideo(existing);
      results.push(existing);
    } else {
      // Add new
      const newVideo = await addVideo(video);
      results.push(newVideo);
    }
  }

  return results;
}

export async function deleteVideo(id: string): Promise<void> {
  await db.deleteVideo(id);
}

export async function deleteVideoByVideoId(videoId: string): Promise<void> {
  await db.deleteVideoByVideoId(videoId);
}
