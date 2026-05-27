/**
 * Demo seed script for Civic Ledger.
 *
 * Loads the users, departments, and issues described in DEMO_DATA.md.
 * Idempotent — safe to run multiple times. Users and departments are
 * upserted by email/code; issues are recreated on each run only if you
 * pass --reset.
 *
 * Usage:
 *   npm run seed:demo            # seed users + depts, top up issues if zero
 *   npm run seed:demo -- --reset # wipe all issues and notifications first
 */

import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Issue, type IssueStatus } from '../models/Issue';
import { Notification } from '../models/Notification';

const PASSWORD = 'demo1234';
const SHOULD_RESET = process.argv.includes('--reset');

/* ---------------------------------- data ---------------------------------- */

const SUPER_ADMIN = {
  name: 'Priya Deshmukh',
  email: 'priya@civic.demo',
  phone: '+91 98000 11111',
};

const DEPARTMENTS = [
  {
    code: 'PWD',
    name: 'Public Works Department',
    description: 'Road repair, footpaths, and public infrastructure',
    categories: ['pothole', 'other'],
    admin: { name: 'Rajesh Kulkarni', email: 'rajesh@pwd.demo' },
  },
  {
    code: 'PMC-W',
    name: 'Water Supply Division',
    description: 'Pipeline leaks and supply disruption',
    categories: ['water'],
    admin: { name: 'Anita Joshi', email: 'anita@water.demo' },
  },
  {
    code: 'ELEC',
    name: 'Electrical Maintenance',
    description: 'Street lighting, exposed wires, transformers',
    categories: ['streetlight', 'electrical'],
    admin: { name: 'Vikram Patil', email: 'vikram@elec.demo' },
  },
  {
    code: 'SAN',
    name: 'Sanitation Department',
    description: 'Waste collection and dumping',
    categories: ['garbage'],
    admin: { name: 'Sneha Gokhale', email: 'sneha@sani.demo' },
  },
  {
    code: 'DRN',
    name: 'Drainage & Sewage',
    description: 'Storm drains, sewage backflow, manhole issues',
    categories: ['drainage'],
    admin: { name: 'Aditya Bhonsle', email: 'aditya@drain.demo' },
  },
] as const;

const CITIZENS = [
  { name: 'Arjun Sharma', email: 'arjun@demo.com', phone: '+91 98765 43210' },
  { name: 'Meera Iyer', email: 'meera@demo.com', phone: '+91 98234 56789' },
  { name: 'Karthik Rao', email: 'karthik@demo.com', phone: '+91 99876 54321' },
  { name: 'Pooja Naik', email: 'pooja@demo.com', phone: '+91 97123 45678' },
];

interface SeedIssue {
  title: string;
  description: string;
  category: string;
  reporterEmail: string;
  deptCode: string | null; // null = unassigned / needs_reroute
  status: IssueStatus;
  lat: number;
  lng: number;
  reroutedFrom?: string; // dept code that flagged it
  hoursAgo: number; // age of the issue (for createdAt)
}

const ISSUES: SeedIssue[] = [
  // Kothrud — water cluster (3)
  {
    title: 'Major water leak near Mhatre Bridge',
    description:
      'Pipeline has been leaking for 3 days. Water pooling on the road and dripping into the underpass.',
    category: 'water',
    reporterEmail: 'arjun@demo.com',
    deptCode: 'PMC-W',
    status: 'in_progress',
    lat: 18.5018,
    lng: 73.8087,
    hoursAgo: 72,
  },
  {
    title: 'No water supply since morning, Karve Road',
    description: 'Whole society has had no water since 6am. Tankers are unable to access the lane.',
    category: 'water',
    reporterEmail: 'meera@demo.com',
    deptCode: 'PMC-W',
    status: 'assigned',
    lat: 18.5021,
    lng: 73.8125,
    hoursAgo: 10,
  },
  {
    title: 'Pipeline burst on Paud Road',
    description: 'Loud noise, water gushing onto the main road. Traffic affected.',
    category: 'water',
    reporterEmail: 'karthik@demo.com',
    deptCode: 'PMC-W',
    status: 'reported',
    lat: 18.4974,
    lng: 73.8068,
    hoursAgo: 1,
  },

  // FC Road / Deccan — potholes (3)
  {
    title: 'Large pothole near Goodluck Cafe',
    description: 'Deep pothole causing two-wheelers to skid. Already had a couple of accidents.',
    category: 'pothole',
    reporterEmail: 'pooja@demo.com',
    deptCode: 'PWD',
    status: 'resolved',
    lat: 18.5189,
    lng: 73.8418,
    hoursAgo: 96,
  },
  {
    title: 'Broken road tiles, Deccan Gymkhana',
    description: 'Pavement tiles loose along the entire footpath. Trip hazard at night.',
    category: 'pothole',
    reporterEmail: 'arjun@demo.com',
    deptCode: 'PWD',
    status: 'in_progress',
    lat: 18.5151,
    lng: 73.8438,
    hoursAgo: 36,
  },
  {
    title: 'Pothole causing traffic, FC Road junction',
    description:
      'Right at the signal — cars stop awkwardly and back up the queue. Needs urgent patching.',
    category: 'pothole',
    reporterEmail: 'meera@demo.com',
    deptCode: 'PWD',
    status: 'assigned',
    lat: 18.5202,
    lng: 73.8410,
    hoursAgo: 18,
  },

  // Hadapsar — garbage (2)
  {
    title: 'Overflowing bin near Magarpatta gate',
    description: 'Has been overflowing for a week. Stray dogs scattering waste around.',
    category: 'garbage',
    reporterEmail: 'karthik@demo.com',
    deptCode: 'SAN',
    status: 'assigned',
    lat: 18.5089,
    lng: 73.9260,
    hoursAgo: 24,
  },
  {
    title: 'Garbage dumped in empty plot, Amanora',
    description:
      'Someone is dumping construction debris and household waste on the empty plot near Sector 4.',
    category: 'garbage',
    reporterEmail: 'pooja@demo.com',
    deptCode: 'SAN',
    status: 'reported',
    lat: 18.5145,
    lng: 73.9395,
    hoursAgo: 4,
  },

  // Aundh — electrical (2)
  {
    title: 'Streetlight out for a week, ITI Road',
    description:
      'Entire 200m stretch has been dark since last Tuesday. Unsafe for women walking home after work.',
    category: 'streetlight',
    reporterEmail: 'arjun@demo.com',
    deptCode: 'ELEC',
    status: 'in_progress',
    lat: 18.5610,
    lng: 73.8073,
    hoursAgo: 168,
  },
  {
    title: 'Exposed wires hanging dangerously low',
    description:
      'From transformer pole — kids can almost reach them. Already raining and these are live.',
    category: 'electrical',
    reporterEmail: 'meera@demo.com',
    deptCode: 'ELEC',
    status: 'assigned',
    lat: 18.5598,
    lng: 73.8112,
    hoursAgo: 6,
  },

  // Camp — drainage (1)
  {
    title: 'Sewage backflow on East Street',
    description: 'Backflow from manhole onto the street. Smell is unbearable.',
    category: 'drainage',
    reporterEmail: 'karthik@demo.com',
    deptCode: 'DRN',
    status: 'assigned',
    lat: 18.5158,
    lng: 73.8794,
    hoursAgo: 12,
  },

  // Reroute queue — needs_reroute
  {
    title: 'Stray dog problem near school, Kondhwa',
    description:
      'Pack of strays growling at children entering the school gate. Parents avoiding the lane.',
    category: 'other',
    reporterEmail: 'pooja@demo.com',
    deptCode: null,
    status: 'needs_reroute',
    lat: 18.4646,
    lng: 73.8966,
    reroutedFrom: 'SAN',
    hoursAgo: 8,
  },
];

/* --------------------------------- helpers --------------------------------- */

function hoursAgoDate(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/**
 * Plausible status history for a given final status. Each prior status is
 * stamped a few hours apart leading up to createdAt + present.
 */
function buildStatusHistory(
  finalStatus: IssueStatus,
  createdAt: Date,
  reroutedFrom: string | undefined
): Array<{ status: IssueStatus; at: Date; note?: string }> {
  const history: Array<{ status: IssueStatus; at: Date; note?: string }> = [
    { status: 'reported', at: createdAt },
  ];
  const step = (offsetHours: number) =>
    new Date(createdAt.getTime() + offsetHours * 60 * 60 * 1000);

  switch (finalStatus) {
    case 'reported':
      // nothing more
      break;
    case 'assigned':
      history.push({ status: 'assigned', at: step(0.1), note: 'Auto-routed by system' });
      break;
    case 'in_progress':
      history.push({ status: 'assigned', at: step(0.1), note: 'Auto-routed by system' });
      history.push({
        status: 'in_progress',
        at: step(2),
        note: 'Crew dispatched',
      });
      break;
    case 'resolved':
      history.push({ status: 'assigned', at: step(0.1), note: 'Auto-routed by system' });
      history.push({ status: 'in_progress', at: step(4), note: 'Crew dispatched' });
      history.push({
        status: 'resolved',
        at: step(24),
        note: 'Pothole filled and tar-sealed',
      });
      break;
    case 'rejected':
      history.push({ status: 'assigned', at: step(0.1) });
      history.push({
        status: 'rejected',
        at: step(3),
        note: 'Not a valid report',
      });
      break;
    case 'needs_reroute':
      if (reroutedFrom) {
        history.push({ status: 'assigned', at: step(0.1) });
        history.push({
          status: 'needs_reroute',
          at: step(2),
          note: `${reroutedFrom} flagged this as outside their scope`,
        });
      } else {
        history.push({
          status: 'needs_reroute',
          at: step(0.1),
          note: 'No matching department on initial routing',
        });
      }
      break;
  }
  return history;
}

/* ----------------------------------- run ----------------------------------- */

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✔ Connected to MongoDB');

  if (SHOULD_RESET) {
    console.log('⚠ --reset: wiping issues and notifications...');
    await Promise.all([Issue.deleteMany({}), Notification.deleteMany({})]);
  }

  // 1. Super-admin
  let superAdmin = await User.findOne({ email: SUPER_ADMIN.email });
  if (!superAdmin) {
    superAdmin = await User.create({
      ...SUPER_ADMIN,
      password: PASSWORD,
      role: 'super_admin',
    });
    console.log(`✔ Created super-admin ${SUPER_ADMIN.email}`);
  } else {
    console.log(`= Super-admin exists ${SUPER_ADMIN.email}`);
  }

  // 2. Departments + their admins
  const deptByCode = new Map<string, any>();
  for (const dept of DEPARTMENTS) {
    let d = await Department.findOne({ code: dept.code });
    if (!d) {
      d = await Department.create({
        name: dept.name,
        code: dept.code,
        description: dept.description,
        categories: dept.categories as any,
        status: 'approved',
      });
      console.log(`✔ Created department ${dept.code}`);
    } else if (d.status !== 'approved') {
      d.status = 'approved';
      await d.save();
      console.log(`✔ Approved existing department ${dept.code}`);
    } else {
      console.log(`= Department exists ${dept.code}`);
    }
    deptByCode.set(dept.code, d);

    // Admin user
    let admin = await User.findOne({ email: dept.admin.email });
    if (!admin) {
      await User.create({
        name: dept.admin.name,
        email: dept.admin.email,
        password: PASSWORD,
        role: 'department_admin',
        department: d._id,
      });
      console.log(`✔ Created dept admin ${dept.admin.email}`);
    } else {
      // ensure dept linkage
      if (!admin.department || admin.department.toString() !== d._id.toString()) {
        admin.department = d._id;
        admin.role = 'department_admin';
        await admin.save();
      }
      console.log(`= Dept admin exists ${dept.admin.email}`);
    }
  }

  // 3. Citizens
  const citizenByEmail = new Map<string, any>();
  for (const c of CITIZENS) {
    let u = await User.findOne({ email: c.email });
    if (!u) {
      u = await User.create({
        ...c,
        password: PASSWORD,
        role: 'citizen',
      });
      console.log(`✔ Created citizen ${c.email}`);
    } else {
      console.log(`= Citizen exists ${c.email}`);
    }
    citizenByEmail.set(c.email, u);
  }

  // 4. Issues — skip seeding if there's already a non-trivial set,
  //    unless we reset above. This keeps repeat runs cheap.
  const existing = await Issue.countDocuments();
  if (existing >= ISSUES.length) {
    console.log(
      `= ${existing} issue(s) already in DB; skipping issue seed. Re-run with --reset to recreate.`
    );
  } else {
    let created = 0;
    for (const i of ISSUES) {
      const reporter = citizenByEmail.get(i.reporterEmail);
      if (!reporter) {
        console.warn(`Skipping "${i.title}" — reporter ${i.reporterEmail} not found`);
        continue;
      }
      const dept = i.deptCode ? deptByCode.get(i.deptCode) : null;
      const createdAt = hoursAgoDate(i.hoursAgo);
      const history = buildStatusHistory(i.status, createdAt, i.reroutedFrom);

      await Issue.create({
        title: i.title,
        description: i.description,
        category: i.category,
        photos: [],
        location: {
          type: 'Point',
          coordinates: [i.lng, i.lat],
        },
        reportedBy: reporter._id,
        assignedDepartment: dept ? dept._id : null,
        status: i.status,
        statusHistory: history,
        createdAt,
        updatedAt: history[history.length - 1].at,
      });
      created++;
    }
    console.log(`✔ Created ${created} demo issues`);
  }

  console.log('\n──────────────────────────────────────────────');
  console.log('Demo data ready. See DEMO_DATA.md for the script.');
  console.log('All passwords: demo1234');
  console.log('──────────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✘ Demo seed failed:', err);
  process.exit(1);
});
