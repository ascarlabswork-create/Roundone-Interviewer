import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  IndianRupee,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/primitives.tsx'

const benefits = [
  { title: 'Verified Professional Profile', body: 'Show candidates a trusted identity, employment, and LinkedIn check.', icon: BadgeCheck },
  { title: 'Flexible Availability', body: 'Open evening and weekend slots that fit around your day job.', icon: CalendarClock },
  { title: 'Set Your Own Pricing', body: 'Price each mock independently — coding, design, behavioral, or a full loop.', icon: CircleDollarSign },
  { title: 'Reach Relevant Candidates', body: 'Get requests from people targeting the roles and levels you actually coach.', icon: Users },
  { title: 'Earn Per Interview', body: 'Track session fees, platform fees, and payouts from one earnings view.', icon: IndianRupee },
]

const steps = [
  { n: '01', title: 'Create your profile' },
  { n: '02', title: 'Get verified' },
  { n: '03', title: 'Add your services' },
  { n: '04', title: 'Receive bookings' },
  { n: '05', title: 'Conduct interviews' },
  { n: '06', title: 'Earn' },
]

export function LandingPage() {
  return (
    <div>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              For professional interviewers
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl">
              Share your interview expertise.
              <span className="block">Help candidates succeed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Join RoundOne as a verified interviewer, conduct realistic mock interviews, provide
              actionable feedback, and earn from your expertise.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/interviewer/register">
                <Button size="lg" fullWidth>
                  Become an Interviewer
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" fullWidth>
                  Learn How It Works
                </Button>
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Already on RoundOne?{' '}
              <Link to="/interviewer/dashboard" className="font-semibold text-navy-950">
                Go to dashboard
              </Link>
            </p>
          </div>
          <Card className="p-6">
            <p className="text-sm font-medium text-slate-500">Practice snapshot</p>
            <h2 className="mt-1 text-lg font-semibold text-navy-950">Rahul Sharma · Staff SWE, Google</h2>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-slate-500">Upcoming</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">2</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-slate-500">Completed</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">428</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-slate-500">Rating</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">4.9</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-slate-500">This month</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">₹48,500</dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold text-navy-950">Why interviewers join RoundOne</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => (
            <Card key={item.title} className="p-5">
              <item.icon className="h-5 w-5 text-navy-700" />
              <h3 className="mt-3 font-semibold text-navy-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold text-navy-950">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{step.n}</p>
                <p className="mt-2 text-lg font-semibold text-navy-950">{step.title}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link to="/interviewer/register">
              <Button size="lg">Become an Interviewer</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
