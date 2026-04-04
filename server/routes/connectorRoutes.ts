import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { 
  getGoogleAuthUrl, 
  googleCallback, 
  getCalendarEvents, 
  getSpotifyAuthUrl, 
  spotifyCallback, 
  getSpotifyStatus,
  controlSpotify
} from '../controllers/connectorController';

const router = express.Router();

// Google Calendar
router.get('/google/url', protect, getGoogleAuthUrl);
router.get('/google/callback', googleCallback);
router.get('/google/calendar', protect, getCalendarEvents);

// Spotify
router.get('/spotify/url', protect, getSpotifyAuthUrl);
router.get('/spotify/callback', spotifyCallback);
router.get('/spotify/status', protect, getSpotifyStatus);
router.put('/spotify/control/:action', protect, controlSpotify);

export default router;
