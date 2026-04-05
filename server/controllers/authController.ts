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
  subject: 'Verify your identity - VITRA',
  text: `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`,
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f6f8fa; padding: 40px 0;">
      
      <div style="max-width: 480px; margin: auto; text-align: center;">
        
        <!-- Logo -->
        <div style="margin-bottom: 20px;">
          <span style="font-size: 28px;">🤖</span>
        </div>

        <!-- Heading -->
        <h2 style="font-weight: 400; color: #24292f;">
          Please verify your identity, <strong>${email.split('@')[0]}</strong>
        </h2>

        <!-- Card -->
        <div style="background: #ffffff; border: 1px solid #d0d7de; border-radius: 8px; padding: 24px; margin-top: 20px; text-align: left;">
          
          <p style="margin: 0 0 10px; color: #24292f;">
            Here is your VITRA authentication code:
          </p>

          <!-- OTP -->
          <div style="text-align: center; margin: 20px 0;">
            <span style="
              font-size: 26px;
              letter-spacing: 6px;
              font-weight: 500;
              color: #24292f;
            ">
              ${otp}
            </span>
          </div>

          <p style="font-size: 14px; color: #57606a;">
            This code is valid for <strong>10 minutes</strong> and can only be used once.
          </p>

          <p style="font-size: 14px; color: #57606a;">
            Please don’t share this code with anyone. VITRA will never ask for it via email or phone.
          </p>

          <p style="font-size: 14px; color: #57606a; margin-top: 20px;">
            Thanks,<br/>
            <strong>VITRA Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <p style="font-size: 12px; color: #57606a; margin-top: 20px;">
          You're receiving this email because a verification request was made for your VITRA account.
          If this wasn't you, you can safely ignore this email.
        </p>

      </div>
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
