import { createSign, createVerify, createHash } from 'crypto';

export interface Signer {
  sign: (data: string) => string;
  verify: (data: string, signature: string, publicKey: string) => boolean;
}

export const createSigner = (privateKey: string): Signer => {
  return {
    sign: (data: string): string => {
      const sign = createSign('SHA256');
      sign.update(data);
      sign.end();
      return sign.sign(privateKey, 'base64');
    },
    verify: (data: string, signature: string, publicKey: string): boolean => {
      const verify = createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    },
  };
};

export const hashCode = (code: string): string => {
  return createHash('sha256').update(code).digest('hex');
};

export const generateNonce = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};
