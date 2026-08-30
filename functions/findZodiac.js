function findZodiacSign(month, day) {
    if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) {
        return {
            zodiacSignInEng: 'Aquarius',
            zodiacSignInMarathi: 'कुंभ',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Aquarius.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Aquarius.svg',
        }
        //"Aquarius";
    } else if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) {
        return {
            zodiacSignInEng: 'Pisces',
            zodiacSignInMarathi: 'मीन',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Pisces.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Pisces.svg',
        }
        // "Pisces";
    }else if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
        return {
            zodiacSignInEng: 'Aries',
            zodiacSignInMarathi: 'मेष',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Aries.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Aries.svg',
        }
        // 'Aries';
    } else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
        return {
            zodiacSignInEng: 'Taurus',
            zodiacSignInMarathi: 'वृषभ',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Taurus.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Taurus.svg',
        }
        // 'Taurus';
    } else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
        return {
            zodiacSignInEng: 'Gemini',
            zodiacSignInMarathi: 'मिथुन',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Gemini.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Gemini.svg',
        }
        //'Gemini';
    } else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
        return {
            zodiacSignInEng: 'Cancer',
            zodiacSignInMarathi: 'कर्क',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Cancer.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Cancer.svg',
        }
        //'Cancer';
    } else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
        return {
            zodiacSignInEng: 'Leo',
            zodiacSignInMarathi: 'सिंह',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Leo.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Leo.svg',
        }
        //'Leo';
    } else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
        return {
            zodiacSignInEng: 'Virgo',
            zodiacSignInMarathi: 'कन्या',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Virgo.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Virgo.svg',
        }
        //'Virgo';
    } else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
        return {
            zodiacSignInEng: 'Libra',
            zodiacSignInMarathi: 'तुला',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Libra.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Libra.svg',
        }
        //'Libra';
    } else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
        return {
            zodiacSignInEng: 'Scorpio',
            zodiacSignInMarathi: 'वृश्चिक',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Scorpion.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Scorpion.svg',
        }
        // 'Scorpio';
    } else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
        return {
            zodiacSignInEng: 'Sagittarius',
            zodiacSignInMarathi: 'धनु',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Sagittarius.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Sagittarius.svg',
        }
        //'Sagittarius';
    } else {
        return {
            zodiacSignInEng: 'Capricorn',
            zodiacSignInMarathi: 'मकर',
            zodiacPngUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/PNG_icons/Capricorn.png',
            zodiacSvgUrl: 'https://companion-public.s3.ap-south-1.amazonaws.com/Zodiac_Icons/SVG_icons/Capricorn.svg',
        }
        // 'Capricorn';
    }
}
module.exports.findZodiacSign = findZodiacSign;