import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'vitra_secret_key_2026';

// Helper to generate JWT
const generateToken = (userId: string) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Helper to send OTP email
const sendOTPEmail = async (email: string, otp: string) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  console.log('DEBUG: EMAIL_USER is:', emailUser);

  if (!emailUser || !emailPass) {
    console.warn('Email credentials not provided. OTP will only be available in debug mode.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass.replace(/\s/g, ''),
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || emailUser,
    to: email,
    subject: 'Your VITRA Password Reset OTP',
    text: `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Password Reset</h2>
        <p>You requested a password reset for your VITRA account.</p>
        <p>Your 6-digit OTP is:</p>
        <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f4f4f4; border-radius: 5px; display: inline-block;">
          ${otp}
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// ... initialization ...

// Helper to check database connection
const checkDbConnection = (res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('Database not connected. ReadyState:', mongoose.connection.readyState);
    res.status(503).json({ 
      message: 'Database connection is not ready. Please check if MONGODB_URI is configured in Settings > Secrets.' 
    });
    return false;
  }
  return true;
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all fields (name, email, password)' });
    }

    if (!checkDbConnection(res)) return;

    // Check if user exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email address' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = generateToken(newUser._id.toString());

    res.status(201).json({
      token,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error: any) {
    console.error('Register error details:', error);
    res.status(500).json({ 
      message: 'Server error during registration', 
      error: error.message 
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    if (!checkDbConnection(res)) return;

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Please login with Google' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id.toString());

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login', 
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined 
    });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    if (!checkDbConnection(res)) return;

    // Verify using Google's tokeninfo endpoint
    console.log('Google token received, length:', token.length, 'starts with:', token.substring(0, 20));
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const payload = await tokenInfoRes.json();
    console.log('Google tokeninfo response status:', tokenInfoRes.status, 'payload keys:', Object.keys(payload));

    if (!tokenInfoRes.ok || payload.error) {
      console.error('Google tokeninfo failed:', payload);
      return res.status(401).json({ message: 'Invalid Google token. Please try again.', debug: payload.error });
    }

    const { email, name, sub: googleId, picture: photoURL } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Email not provided by Google' });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ name: name || 'Google User', email, googleId, photoURL });
    } else {
      user.googleId = googleId;
      user.photoURL = photoURL;
      await user.save();
    }

    const jwtToken = generateToken(user._id.toString());

    res.json({
      token: jwtToken,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
      googleTokens: {
        accessToken: !!user.googleTokens?.accessToken
      },
      spotifyTokens: {
        accessToken: !!user.spotifyTokens?.accessToken
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Please provide an email' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // For security, don't reveal if user exists
      return res.json({ message: 'If an account with that email exists, an OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = otpExpires;
    await user.save();

    const emailSent = await sendOTPEmail(email, otp);

    res.json({ 
      message: 'If an account with that email exists, an OTP has been sent.',
      debugOTP: process.env.NODE_ENV !== 'production' ? otp : undefined,
      emailSent
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Please provide email, otp and new password' });
    }

    const user = await User.findOne({ 
      email,
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
