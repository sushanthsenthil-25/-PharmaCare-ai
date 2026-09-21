import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['USER', 'PHARMACIST', 'OWNER', 'ADMIN'],
      default: 'USER',
    },
    businessName: {
      type: String,
      default: 'PharmaCare Customer',
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: 'Indiranagar, Bangalore 560038',
    },
    avatar: {
      type: String,
      default: 'https://lh3.googleusercontent.com/aida/AEtjO1UXIyqn0rViTj34nY5-ERNwCnA7Zwj8rGPIMHsg29hvs-twt6_AsDLdWcg9buDJTuJC142qVvPhhA65hX8te1Q20d7ykmZ16UYBm10zL3vVzdOm-CKDgKRO-sszyTtnTOK4Iz192j94dxxY5Ki9HoZV9D4RFUYCj-z37Kd6PAUuICxpSIMc1eqzbjv6hSg8G8Q2x4bXE7V_7DDyNDA48lK3-lYsqCJyvcQQF_FGoZ1Z-z0lkB3yGmMKbA1w',
    },
    profilePhoto: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        if (!ret.profilePhoto && ret.avatar) {
          ret.profilePhoto = ret.avatar;
        }
        delete ret.password;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Encrypt password using bcrypt before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
export default User;
