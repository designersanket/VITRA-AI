import { Request, Response } from 'express';
import { google } from 'googleapis';
import axios from 'axios';
import { User } from '../models/User';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const getRedirectUri = (req: Request, path: string) => {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return `${appUrl}${path}`;
};

// --- Google Calendar ---

export const getGoogleAuthUrl = (req: any, res: Response) => {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getRedirectUri(req, '/api/connect/google/callback')
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly', 'profile', 'email'],
    prompt: 'consent',
    state: req.user.id
  });

  res.json({ url });
};

export const googleCallback = async (req: any, res: Response) => {
  const { code, state: userId } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getRedirectUri(req, '/api/connect/google/callback')
  );

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (!userId) {
      throw new Error('No user ID in state');
    }

    await User.findByIdAndUpdate(userId, {
      googleTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
      }
    });

    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }, '*');
            window.close();
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Google OAuth Error:', error);
    res.status(500).send('Authentication failed');
  }
};

export const getCalendarEvents = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.googleTokens?.accessToken) {
      return res.status(401).json({ error: 'Google Calendar not connected' });
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken,
      expiry_date: user.googleTokens.expiryDate
    });

    // Check if token is expired and refresh if needed
    if (user.googleTokens.expiryDate && user.googleTokens.expiryDate <= Date.now() + 60000) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      user.googleTokens.accessToken = credentials.access_token!;
      user.googleTokens.expiryDate = credentials.expiry_date!;
      user.markModified('googleTokens');
      await user.save();
      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items);
  } catch (error) {
    console.error('Calendar Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
};

// --- Spotify ---

export const getSpotifyAuthUrl = (req: any, res: Response) => {
  const redirectUri = getRedirectUri(req, '/api/connect/spotify/callback');
  const scope = 'user-read-currently-playing user-read-recently-played user-modify-playback-state';
  
  const url = `https://accounts.spotify.com/authorize?` +
    new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID!,
      scope: scope,
      redirect_uri: redirectUri,
      show_dialog: 'true',
      state: req.user.id
    }).toString();

  res.json({ url });
};

export const spotifyCallback = async (req: any, res: Response) => {
  const { code, state: userId } = req.query;
  const redirectUri = getRedirectUri(req, '/api/connect/spotify/callback');

  try {
    if (!userId) {
      throw new Error('No user ID in state');
    }

    const response = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    
    await User.findByIdAndUpdate(userId, {
      spotifyTokens: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiryDate: Date.now() + (expires_in * 1000)
      }
    });

    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'spotify' }, '*');
            window.close();
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Spotify OAuth Error:', error);
    res.status(500).send('Authentication failed');
  }
};

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
    await user.save();
    return access_token;
  } catch (error) {
    console.error('Spotify Token Refresh Error:', error);
    return null;
  }
}

export const getSpotifyStatus = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.spotifyTokens?.accessToken) {
      return res.status(401).json({ error: 'Spotify not connected' });
    }

    // Check if token expired and refresh if needed
    let accessToken = user.spotifyTokens.accessToken;
    if (user.spotifyTokens.expiryDate && user.spotifyTokens.expiryDate <= Date.now() + 60000) {
      const refreshed = await refreshSpotifyToken(user);
      if (refreshed) accessToken = refreshed;
    }

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.status === 204 || !response.data) {
        // Nothing playing, get recently played
        const recentRes = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        return res.json({ status: 'recent', data: recentRes.data.items[0] });
      }

      res.json({ status: 'playing', data: response.data });
    } catch (err: any) {
      if (err.response?.status === 401) {
        return res.status(401).json({ error: 'Spotify token expired' });
      }
      if (err.response?.status === 403) {
        return res.status(403).json({ 
          error: 'Spotify access forbidden',
          details: 'This usually means your email needs to be added to the "Users and Access" list in the Spotify Developer Dashboard, or you are trying to use playback controls without a Premium account.'
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('Spotify Status Error:', error);
    res.status(500).json({ error: 'Failed to fetch Spotify status' });
  }
};

export const controlSpotify = async (req: any, res: Response) => {
  try {
    const { action } = req.params; // play, pause, next, previous
    const user = await User.findById(req.user.id);
    if (!user || !user.spotifyTokens?.accessToken) {
      return res.status(401).json({ error: 'Spotify not connected' });
    }

    let accessToken = user.spotifyTokens.accessToken;
    if (user.spotifyTokens.expiryDate && user.spotifyTokens.expiryDate <= Date.now() + 60000) {
      const refreshed = await refreshSpotifyToken(user);
      if (refreshed) accessToken = refreshed;
    }

    let endpoint = '';
    let method: 'PUT' | 'POST' = 'PUT';

    switch (action) {
      case 'play':
        endpoint = 'https://api.spotify.com/v1/me/player/play';
        break;
      case 'pause':
        endpoint = 'https://api.spotify.com/v1/me/player/pause';
        break;
      case 'next':
        endpoint = 'https://api.spotify.com/v1/me/player/next';
        method = 'POST';
        break;
      case 'previous':
        endpoint = 'https://api.spotify.com/v1/me/player/previous';
        method = 'POST';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    await axios({
      method,
      url: endpoint,
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error(`Spotify Control Error (${req.params.action}):`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to control Spotify',
      details: error.response?.data?.error?.message || error.message
    });
  }
};
