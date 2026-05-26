import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import User from '../models/User';

// GET /api/users/me
export const getMe = async (req: Request, res: Response) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ success: true, data: user });
};

// PUT /api/users/me  (name + avatar)
export const updateMe = async (req: Request, res: Response) => {
  const { name, avatarBase64 } = req.body;
  const updates: any = {};

  if (name) updates.name = name;

  if (avatarBase64) {
    const result = await cloudinary.uploader.upload(avatarBase64, {
      folder: 'civic_ledger/avatars',
      transformation: [{ width: 200, height: 200, crop: 'fill' }],
    });
    updates.avatar = result.secure_url;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select('-password');

  res.json({ success: true, data: user });
};

// PUT /api/users/me/password
export const updatePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, message: 'Both fields required' });

  const user = await User.findById(req.user._id).select('+password');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch)
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
};