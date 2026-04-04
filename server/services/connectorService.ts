import { google } from 'googleapis';
import axios from 'axios';
import { User } from '../models/User';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function refreshSpotifyToken(user: any) {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.spotifyTokens.refreshToken,
      }).toString(),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = response.data;
    user.spotifyTokens.accessToken = access_token;
    user.spotifyTokens.expiryDate = Date.now() + (expires_in * 1000);
    user.markModified('spotifyTokens');
    await user.save();
    return access_token;
  } catch (error: any) {
    console.error('Spotify Token Refresh Error:', error.response?.data || error.message);
    return null;
  }
}

export async function getRealTimeContext(userId: string) {
  const user = await User.findById(userId);
  if (!user) return "";

  let context = "\nREAL-TIME CONTEXT (Use this to be context-aware):\n";
  let hasData = false;

  // 1. Google Calendar
  if (user.googleTokens?.accessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials({
        access_token: user.googleTokens.accessToken,
        refresh_token: user.googleTokens.refreshToken,
        expiry_date: user.googleTokens.expiryDate
      });

      // Check if token is expired and refresh if needed
      if (user.googleTokens.expiryDate && user.googleTokens.expiryDate <= Date.now()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        user.googleTokens.accessToken = credentials.access_token!;
        user.googleTokens.expiryDate = credentials.expiry_date!;
        await user.save();
      }

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      if (events.length > 0) {
        context += "- Upcoming Calendar Events for Today:\n";
        events.forEach(event => {
          const start = event.start?.dateTime || event.start?.date;
          context += `  * ${event.summary} at ${new Date(start!).toLocaleTimeString()}\n`;
        });
        hasData = true;
      }
    } catch (error) {
      console.error('Context Fetch Error (Google):', error);
    }
  }

  // 2. Spotify
  if (user.spotifyTokens?.accessToken) {
    try {
      let accessToken = user.spotifyTokens.accessToken;

      // Refresh if expired
      if (user.spotifyTokens.expiryDate && user.spotifyTokens.expiryDate <= Date.now() + 60000) {
        const refreshed = await refreshSpotifyToken(user);
        if (refreshed) accessToken = refreshed;
      }

      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.status === 200 && response.data?.item) {
        const track = response.data.item;
        context += `- Currently Listening to: "${track.name}" by ${track.artists.map((a: any) => a.name).join(', ')}\n`;
        hasData = true;
      } else {
        // Try recently played
        const recentRes = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (recentRes.data.items.length > 0) {
          const track = recentRes.data.items[0].track;
          context += `- Recently Listened to: "${track.name}" by ${track.artists.map((a: any) => a.name).join(', ')}\n`;
          hasData = true;
        }
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error('Spotify 403 Forbidden: Ensure the user email is added to "Users and Access" in the Spotify Dashboard.');
      } else {
        console.error('Context Fetch Error (Spotify):', error.response?.data || error.message);
      }
    }
  }

  return hasData ? context : "";
}
