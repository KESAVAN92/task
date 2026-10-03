import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import Request from './models/Request.js';

const app = express();
const preferredPort = Number(process.env.PORT || 5000);
const statuses = ['Open', 'In progress', 'Completed'];

async function getAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    const isAvailable = await new Promise((resolve) => {
      const tester = net.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port);
    });

    if (isAvailable) return port;
  }

  throw new Error(`No free port available starting from ${startPort}.`);
}
const mongoEnabled = Boolean(process.env.MONGO_URI);
let memoryRequests = [];
const lastReminderAt = new Map();

app.use(cors());
app.use(express.json());

function isoDate(daysFromToday) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString();
}

const sampleRequests = [
  {
    title: 'Quarterly sales receipts',
    clientName: 'Juniper & Co. (Sample)',
    assignee: 'Morgan Lee',
    dueDate: isoDate(-3),
    status: 'Open'
  },
  {
    title: 'Reconcile operating account',
    clientName: 'Northstar Studio (Sample)',
    assignee: 'Riley Chen',
    dueDate: isoDate(0),
    status: 'In progress'
  },
  {
    title: 'Upload payroll summary',
    clientName: 'Cedar Works (Sample)',
    assignee: 'Morgan Lee',
    dueDate: isoDate(4),
    status: 'Open'
  },
  {
    title: 'Review expense categories',
    clientName: 'Northstar Studio (Sample)',
    assignee: 'Alex Rivera',
    dueDate: isoDate(-1),
    status: 'Completed'
  }
];

function sortByDueDate(requests) {
  return requests.sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate));
}

function isOverdue(request) {
  const dueDate = new Date(request.dueDate);
  const today = new Date();
  dueDate.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);
  return request.status !== 'Completed' && dueDate < today;
}

async function getAllRequests() {
  if (mongoEnabled) return Request.find().sort({ dueDate: 1 }).lean();
  return sortByDueDate([...memoryRequests]);
}

async function findRequest(id) {
  if (mongoEnabled) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Request.findById(id);
  }
  return memoryRequests.find((request) => request._id === id) || null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: mongoEnabled ? 'mongodb' : 'memory' });
});

app.get('/api/requests', async (req, res, next) => {
  try {
    const requests = await getAllRequests();
    const filtered = req.query.status
      ? requests.filter((request) => request.status === req.query.status)
      : requests;
    res.json(sortByDueDate(filtered));
  } catch (error) {
    next(error);
  }
});

app.get('/api/requests/overdue', async (_req, res, next) => {
  try {
    const requests = (await getAllRequests()).filter(isOverdue);
    res.json(sortByDueDate(requests));
  } catch (error) {
    next(error);
  }
});

app.post('/api/requests', async (req, res, next) => {
  try {
    const { title, clientName, assignee, dueDate, status = 'Open' } = req.body;
    if (![title, clientName, assignee, dueDate].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Title, client name, assignee, and due date are required.' });
    }
    if (Number.isNaN(Date.parse(dueDate))) {
      return res.status(400).json({ message: 'Enter a valid due date.' });
    }
    if (!statuses.includes(status)) {
      return res.status(400).json({ message: 'Choose a valid status.' });
    }

    const values = { title, clientName, assignee, dueDate, status };
    const request = mongoEnabled
      ? await Request.create(values)
      : { ...values, _id: randomUUID(), createdAt: new Date().toISOString() };
    if (!mongoEnabled) memoryRequests.push(request);
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/requests/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) {
      return res.status(400).json({ message: 'Choose a valid status.' });
    }
    const request = await findRequest(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (mongoEnabled) {
      request.status = status;
      await request.save();
      return res.json(request);
    }
    request.status = status;
    res.json(request);
  } catch (error) {
    next(error);
  }
});

async function runReminderCheck(force = false) {
  const overdueRequests = (await getAllRequests()).filter(isOverdue);
  const now = Date.now();
  const reminders = [];
  for (const request of overdueRequests) {
    const id = String(request._id);
    const lastSent = lastReminderAt.get(id) || 0;
    if (!force && now - lastSent < 24 * 60 * 60 * 1000) continue;
    const reminder = `Reminder: "${request.title}" for ${request.clientName} is overdue. Assigned to ${request.assignee}.`;
    lastReminderAt.set(id, now);
    reminders.push({ requestId: id, message: reminder });
    console.info(`[overdue reminder] ${reminder}`);
  }
  return { overdueCount: overdueRequests.length, reminders };
}

app.post('/api/reminders/check', async (_req, res, next) => {
  try {
    res.json(await runReminderCheck(true));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'The request could not be completed.' });
});

async function start() {
  const port = await getAvailablePort(preferredPort);

  if (mongoEnabled) {
    await mongoose.connect(process.env.MONGO_URI);
    if (await Request.countDocuments() === 0) await Request.insertMany(sampleRequests);
    console.info('Connected to MongoDB.');
  } else {
    memoryRequests = sampleRequests.map((request) => ({ ...request, _id: randomUUID() }));
    console.info('Using in-memory demo data; set MONGO_URI to persist requests.');
  }

  app.listen(port, () => console.info(`Accountant tracker API listening on http://localhost:${port}`));
  runReminderCheck().catch((error) => console.error('Reminder check failed:', error));
  setInterval(() => {
    runReminderCheck().catch((error) => console.error('Reminder check failed:', error));
  }, 60 * 60 * 1000);
}

start().catch((error) => {
  console.error('Unable to start the API:', error);
  process.exitCode = 1;
});