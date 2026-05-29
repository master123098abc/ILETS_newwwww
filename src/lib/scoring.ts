export const calculateBandScore = (rawScore: number, section: string, testType?: string): number => {
  if (section === 'Listening') {
    if (rawScore >= 39) return 9.0;
    if (rawScore >= 37) return 8.5;
    if (rawScore >= 35) return 8.0;
    if (rawScore >= 32) return 7.5;
    if (rawScore >= 30) return 7.0;
    if (rawScore >= 26) return 6.5;
    if (rawScore >= 23) return 6.0;
    if (rawScore >= 18) return 5.5;
    if (rawScore >= 16) return 5.0;
    if (rawScore >= 13) return 4.5;
    if (rawScore >= 11) return 4.0;
    if (rawScore >= 8) return 3.5;
    if (rawScore >= 6) return 3.0;
    if (rawScore >= 4) return 2.5;
    if (rawScore >= 2) return 2.0;
    if (rawScore === 1) return 1.0;
    return 0.0;
  }

  if (section === 'Reading') {
    if (testType === 'General Training') {
      if (rawScore === 40) return 9.0;
      if (rawScore === 39) return 8.5;
      if (rawScore >= 37) return 8.0;
      if (rawScore === 36) return 7.5;
      if (rawScore >= 34) return 7.0;
      if (rawScore >= 32) return 6.5;
      if (rawScore >= 30) return 6.0;
      if (rawScore >= 27) return 5.5;
      if (rawScore >= 23) return 5.0;
      if (rawScore >= 19) return 4.5;
      if (rawScore >= 15) return 4.0;
      if (rawScore >= 12) return 3.5;
      if (rawScore >= 9) return 3.0;
      if (rawScore >= 6) return 2.5;
      if (rawScore >= 3) return 2.0;
      if (rawScore >= 1) return 1.0;
      return 0.0;
    } else {
      // Default to Academic
      if (rawScore >= 39) return 9.0;
      if (rawScore >= 37) return 8.5;
      if (rawScore >= 35) return 8.0;
      if (rawScore >= 33) return 7.5;
      if (rawScore >= 30) return 7.0;
      if (rawScore >= 27) return 6.5;
      if (rawScore >= 23) return 6.0;
      if (rawScore >= 19) return 5.5;
      if (rawScore >= 15) return 5.0;
      if (rawScore >= 13) return 4.5;
      if (rawScore >= 10) return 4.0;
      if (rawScore >= 8) return 3.5;
      if (rawScore >= 6) return 3.0;
      if (rawScore >= 4) return 2.5;
      if (rawScore >= 2) return 2.0;
      if (rawScore === 1) return 1.0;
      return 0.0;
    }
  }

  return 0.0;
};
