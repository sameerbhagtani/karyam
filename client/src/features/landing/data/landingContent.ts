import image1 from '@/assets/images/1.jpeg'
import image2 from '@/assets/images/2.jpeg'
import image3 from '@/assets/images/3.jpeg'
import image4 from '@/assets/images/4.jpeg'
import image5 from '@/assets/images/5.jpeg'
import image6 from '@/assets/images/6.jpeg'
import image7 from '@/assets/images/7.jpeg'
import image8 from '@/assets/images/8.jpeg'
import image9 from '@/assets/images/9.jpeg'
import image10 from '@/assets/images/10.jpeg'
import image11 from '@/assets/images/11.png'
import image12 from '@/assets/images/12.jpeg'
import image13 from '@/assets/images/13.jpg'
import image14 from '@/assets/images/14.jpeg'
import image15 from '@/assets/images/15.png'
import image16 from '@/assets/images/16.jpeg'
import image17 from '@/assets/images/17.jpeg'
import image18 from '@/assets/images/18.jpeg'
import image19 from '@/assets/images/19.jpeg'
import image20 from '@/assets/images/20.jpeg'
import image21 from '@/assets/images/21.jpeg'
import image22 from '@/assets/images/22.jpeg'
import image23 from '@/assets/images/23.jpeg'
import image24 from '@/assets/images/24.jpeg'
import image25 from '@/assets/images/25.jpeg'
import image26 from '@/assets/images/26.jpeg'
import image27 from '@/assets/images/27.jpeg'
import image28 from '@/assets/images/28.jpeg'
import image29 from '@/assets/images/29.jpeg'
import image30 from '@/assets/images/30.jpeg'
import image31 from '@/assets/images/31.jpeg'
import image32 from '@/assets/images/32.jpeg'
import image33 from '@/assets/images/33.jpeg'
import image34 from '@/assets/images/34.jpeg'
import image35 from '@/assets/images/35.jpeg'
import image36 from '@/assets/images/36.jpeg'
import image37 from '@/assets/images/37.jpeg'
import image38 from '@/assets/images/38.jpeg'
import image39 from '@/assets/images/39.jpeg'
import image40 from '@/assets/images/40.jpeg'
import image41 from '@/assets/images/41.jpeg'
import image42 from '@/assets/images/42.jpeg'
import image43 from '@/assets/images/43.jpeg'
import image44 from '@/assets/images/44.jpeg'
import image45 from '@/assets/images/45.jpeg'
import image46 from '@/assets/images/46.jpeg'
import image47 from '@/assets/images/47.jpeg'
import image48 from '@/assets/images/48.jpeg'
import image49 from '@/assets/images/49.jpeg'
import image50 from '@/assets/images/50.jpeg'
import image51 from '@/assets/images/51.jpeg'
import feature1 from '@/assets/images/f1.png'
import feature2 from '@/assets/images/f2.png'
import feature3 from '@/assets/images/f3.png'
import feature4 from '@/assets/images/f4.png'
import feature5 from '@/assets/images/f5.png'

export interface OrbitRing {
  radius: number
  duration: number
  direction: number
  angleOffset: number
}

export interface OrbitImage {
  src: string
  index: number
  ring: number
  angle: number
  radius: number
  depth: number
  rotate: number
  fit: 'cover' | 'contain'
  alt: string
}

export interface FeatureCard {
  src: string
  alt: string
  className: string
  startX: string
  startY: string
  endX: string
  endY: string
  startRotate: number
  endRotate: number
  width: string
}

export interface IncidentStage {
  number: string
  title: string
  text: string
}

export interface SignalCard {
  label: string
  value: string
  note: string
}

export interface TeamMessage {
  name: string
  text: string
}

export interface CockpitPanel {
  label: string
  value: string
  tone: 'hot' | 'warn' | 'calm'
}

const nineSixteenIndices = new Set([
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 23, 28, 30, 32, 34, 40, 41, 42, 43, 45,
])

const isNineSixteen = (image: unknown, index: number): boolean => {
  if (
    typeof image === 'object' &&
    image !== null &&
    'width' in image &&
    'height' in image &&
    typeof (image as { width: number; height: number }).width === 'number'
  ) {
    const { width, height } = image as { width: number; height: number }
    return Math.abs(width / height - 9 / 16) < 0.035
  }
  return nineSixteenIndices.has(index + 1)
}

const imageSources: string[] = [
  image1,
  image2,
  image3,
  image4,
  image5,
  image6,
  image7,
  image8,
  image9,
  image10,
  image11,
  image12,
  image13,
  image14,
  image15,
  image16,
  image17,
  image18,
  image19,
  image20,
  image21,
  image22,
  image23,
  image24,
  image25,
  image26,
  image27,
  image28,
  image29,
  image30,
  image31,
  image32,
  image33,
  image34,
  image35,
  image36,
  image37,
  image38,
  image39,
  image40,
  image41,
  image42,
  image43,
  image44,
  image45,
  image46,
  image47,
  image48,
  image49,
  image50,
  image51,
]

export const orbitRings: OrbitRing[] = [
  { radius: 25.27, duration: 32, direction: 1, angleOffset: 2 },
  { radius: 35.2, duration: 42, direction: -1, angleOffset: 9 },
  { radius: 45.13, duration: 52, direction: 1, angleOffset: 16 },
]

export const orbitImages: OrbitImage[] = imageSources.map((src, index) => {
  const ring = index % orbitRings.length
  const ringItemCount = Math.ceil((imageSources.length - ring) / orbitRings.length)
  const positionInRing = Math.floor(index / orbitRings.length)
  const angle = orbitRings[ring].angleOffset + (positionInRing / ringItemCount) * 360

  return {
    src,
    index,
    ring,
    angle,
    radius: orbitRings[ring].radius,
    depth: ring,
    rotate: ((positionInRing % 5) - 2) * 4,
    fit: isNineSixteen(src, index) ? 'cover' : 'contain',
    alt: `Orbiting inspiration image ${index + 1}`,
  }
})

export const featureCards: FeatureCard[] = [
  {
    src: feature1,
    alt: 'Person checking feature card',
    className: 'featureCardPhoto',
    startX: '-58vw',
    startY: '-38vh',
    endX: '-12vw',
    endY: '-12vh',
    startRotate: -8,
    endRotate: -6,
    width: 'clamp(118px, 14vw, 200px)',
  },
  {
    src: feature2,
    alt: 'Currency send card',
    className: 'featureCardBlue',
    startX: '58vw',
    startY: '-34vh',
    endX: '12vw',
    endY: '-8vh',
    startRotate: 7,
    endRotate: 6,
    width: 'clamp(148px, 16vw, 220px)',
  },
  {
    src: feature3,
    alt: 'Exchange approval card',
    className: 'featureCardGreen',
    startX: '-60vw',
    startY: '24vh',
    endX: '-15vw',
    endY: '7vh',
    startRotate: -10,
    endRotate: -5,
    width: 'clamp(150px, 16vw, 220px)',
  },
  {
    src: feature4,
    alt: 'Coffee payment memory card',
    className: 'featureCardWide',
    startX: '62vw',
    startY: '36vh',
    endX: '15vw',
    endY: '9vh',
    startRotate: 9,
    endRotate: 5,
    width: 'clamp(190px, 21vw, 306px)',
  },
  {
    src: feature5,
    alt: 'Secure payment card',
    className: 'featureCardPink',
    startX: '0vw',
    startY: '58vh',
    endX: '0vw',
    endY: '14vh',
    startRotate: 5,
    endRotate: 0,
    width: 'clamp(150px, 16vw, 220px)',
  },
]

export const incidentStages: IncidentStage[] = [
  {
    number: '01',
    title: 'Craft Resume',
    text: 'AI analyzes & optimizes for ATS filters.',
  },
  {
    number: '02',
    title: 'Mock Interview',
    text: 'Realistic voice/text AI roleplay & drills.',
  },
  {
    number: '03',
    title: 'Feedback & Score',
    text: 'Instant actionable metrics & fixes.',
  },
  {
    number: '04',
    title: 'Match & Land',
    text: 'Curated roles matching your verified skills.',
  },
]

export const signalCards: SignalCard[] = [
  { label: 'Readiness', value: '94%', note: 'Mock interview score' },
  { label: 'Resume ATS', value: '98/100', note: 'Keywords optimized' },
  { label: 'Matches', value: '18 Jobs', note: 'Top verified openings' },
  { label: 'Status', value: 'Job Ready', note: 'Interviewing with teams' },
]

export const timeline: string[] = [
  'Resume uploaded & analyzed',
  'ATS score boosted to 98%',
  'Full-stack mock interview initiated',
  'AI feedback generated with score 94%',
  '18 matched job applications submitted',
  'First round scheduled with hiring team',
]

export const teamMessages: TeamMessage[] = [
  {
    name: 'Candidate',
    text: 'Practicing for my Senior Frontend Engineer interview tomorrow.',
  },
  {
    name: 'Karyam AI',
    text: 'Solid grasp of React concurrency! Let us refine your explanation of system design trade-offs.',
  },
  {
    name: 'Recruiter',
    text: 'Candidate readiness verified (Score: 94%). Forwarded to the engineering lead.',
  },
]

export const cockpitPanels: CockpitPanel[] = [
  { label: 'Interviews Held', value: '14,800+', tone: 'hot' },
  { label: 'Offer Rate', value: '89%', tone: 'warn' },
  { label: 'AI Accuracy', value: '99.2%', tone: 'calm' },
]
