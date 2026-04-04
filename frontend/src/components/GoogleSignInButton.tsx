import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

interface GoogleSignInButtonProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
  return (
    <div className="w-full flex justify-center">
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          console.log("Google Login Success:", credentialResponse);
          if (credentialResponse.credential) {
            onSuccess(credentialResponse.credential);
          } else {
            onError("No credential received from Google");
          }
        }}
        onError={() => {
          console.error("Google Login Failed");
          onError('Google sign in failed. Please try again.');
        }}
        use_fedcm_for_prompt={false}
        theme="outline"
        size="large"
        shape="pill"
        width="100%"
      />
    </div>
  );
}
