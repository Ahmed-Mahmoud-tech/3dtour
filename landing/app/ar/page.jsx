import LandingView from '../../components/LandingView.jsx';

export const metadata = {
  title: 'جيت فيرس — جولات افتراضية سينمائية ٣٦٠° في مصر',
  description:
    'بلاش صور… خلّيهم يدخلوا المكان. جولات ٣٦٠° سينمائية متصوّرة للعقارات وقاعات الأفراح والفنادق والكافيهات في الإسكندرية. الجولة لايف خلال ٤٨ ساعة، بلينك واحد أو كود QR.',
  keywords: [
    'جولة افتراضية 360 مصر',
    'تصوير 360 الإسكندرية',
    'جولات افتراضية للعقارات',
    'جولة افتراضية سينمائية',
    'تصوير عقارات 360',
  ],
  alternates: {
    canonical: '/ar/',
    languages: { en: '/', ar: '/ar/' },
  },
  openGraph: {
    title: 'جيت فيرس — جولات افتراضية سينمائية ٣٦٠°',
    description: 'بلاش صور… خلّيهم يدخلوا المكان. جولات ٣٦٠° متصوّرة للعقارات والقاعات والفنادق.',
    url: '/ar/',
    siteName: 'Gateverse',
    locale: 'ar_EG',
    type: 'website',
  },
};

export default function Page() {
  return <LandingView lang="ar" />;
}
