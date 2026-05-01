import Ticket from '../models/Ticket.js';
import Event from '../models/Event.js';
import Organization from '../models/Organization.js';
import jwt from 'jsonwebtoken';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { FedaPay, Transaction, Webhook } = require('fedapay');

const configureFedaPay = () => {
    const secretKey = process.env.FEDAPAY_SECRET_KEY;
    if (!secretKey) {
        throw new Error('FEDAPAY_SECRET_KEY is not configured');
    }

    FedaPay.setApiKey(secretKey);
    FedaPay.setEnvironment(process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox');
};

const createTicketRecord = ({ eventId, userId, tier, pricePaid, paymentTransactionId = null, paymentStatus = 'free' }) => {
    return Ticket.create({
        event: eventId,
        user: userId,
        tier,
        pricePaid,
        paymentTransactionId,
        paymentStatus
    });
};

const normalizePurchaseItems = (rawItems) => {
    if (!Array.isArray(rawItems)) {
        return [];
    }

    return rawItems
        .map(item => ({
            tier: typeof item?.tier === 'string' ? item.tier : '',
            quantity: Number(item?.quantity || 0)
        }))
        .filter(item => item.tier && Number.isFinite(item.quantity) && item.quantity > 0)
        .map(item => ({ ...item, quantity: Math.floor(item.quantity) }));
};

const buildPurchaseFromPayload = ({ event, tier, quantity = 1, items }) => {
    const sourceItems = normalizePurchaseItems(items);
    const normalizedItems = sourceItems.length > 0 ? sourceItems : normalizePurchaseItems([{ tier, quantity }]);

    if (normalizedItems.length === 0) {
        throw new Error('No ticket selected');
    }

    const purchaseItems = normalizedItems.map((item) => {
        const ticketTier = event.tickets.find(t => t.tier === item.tier);
        if (!ticketTier) {
            throw new Error(`Invalid ticket tier: ${item.tier}`);
        }

        return {
            tier: item.tier,
            quantity: item.quantity,
            unitPrice: ticketTier.price
        };
    });

    return purchaseItems;
};

const validateAvailability = async ({ event, purchaseItems }) => {
    for (const item of purchaseItems) {
        const tierConfig = event.tickets.find(t => t.tier === item.tier);
        if (!tierConfig?.limit || tierConfig.limit <= 0) {
            continue;
        }

        const soldCount = await Ticket.countDocuments({
            event: event._id,
            tier: item.tier,
            status: { $ne: 'cancelled' }
        });

        if (soldCount + item.quantity > tierConfig.limit) {
            throw new Error(`Not enough availability for ${item.tier}`);
        }
    }
};

const processApprovedFedapayTransaction = async (transaction) => {
    const metadata = transaction?.custom_metadata || transaction?.metadata || {};
    const eventId = metadata.eventId;
    const userId = metadata.userId;

    if (!eventId || !userId) {
        throw new Error('Missing transaction metadata');
    }

    const event = await Event.findById(eventId);
    if (!event) {
        throw new Error('Event not found');
    }

    let parsedItems = metadata.items;

    if (typeof metadata.items === 'string') {
        try {
            parsedItems = JSON.parse(metadata.items);
        } catch (error) {
            parsedItems = null;
        }
    }

    const purchaseItems = buildPurchaseFromPayload({
        event,
        tier: metadata.tier,
        quantity: metadata.quantity,
        items: parsedItems
    });

    const existingTickets = await Ticket.find({ paymentTransactionId: String(transaction.id) }).sort({ createdAt: 1 });
    const expectedCount = purchaseItems.reduce((acc, item) => acc + item.quantity, 0);

    if (existingTickets.length >= expectedCount && expectedCount > 0) {
        return existingTickets;
    }

    const unitPrices = purchaseItems.reduce((acc, item) => {
        acc[item.tier] = item.unitPrice;
        return acc;
    }, {});

    const toCreateCount = Math.max(0, expectedCount - existingTickets.length);
    const creationQueue = [];

    for (const item of purchaseItems) {
        for (let i = 0; i < item.quantity; i += 1) {
            creationQueue.push({ tier: item.tier, pricePaid: unitPrices[item.tier] });
        }
    }

    const pendingQueue = creationQueue.slice(existingTickets.length, existingTickets.length + toCreateCount);

    const newTickets = await Promise.all(
        pendingQueue.map((item) => createTicketRecord({
            eventId,
            userId,
            tier: item.tier,
            pricePaid: item.pricePaid,
            paymentTransactionId: String(transaction.id),
            paymentStatus: 'paid'
        }))
    );

    return [...existingTickets, ...newTickets];
};

// 1. Acheter un ticket
export const buyTicket = async (req, res) => {
    try {
        const { eventId, tier, quantity = 1, items } = req.body;
        const userId = req.user._id;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const purchaseItems = buildPurchaseFromPayload({ event, tier, quantity, items });
        await validateAvailability({ event, purchaseItems });
        const totalQuantity = purchaseItems.reduce((acc, item) => acc + item.quantity, 0);
        const totalAmount = purchaseItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

        if (totalQuantity <= 0) {
            return res.status(400).json({ message: 'No ticket selected' });
        }

        if (totalAmount <= 0) {
            const tickets = await Promise.all(
                purchaseItems.flatMap(item =>
                    Array.from({ length: item.quantity }, () => createTicketRecord({
                        eventId,
                        userId,
                        tier: item.tier,
                        pricePaid: 0,
                        paymentStatus: 'free'
                    }))
                )
            );

            return res.status(201).json({
                ticket: tickets[0],
                tickets,
                requiresPayment: false
            });
        }

        configureFedaPay();

        const transaction = await Transaction.create({
            description: `Achat de ${totalQuantity} billet(s) pour ${event.title}`,
            amount: totalAmount,
            currency: { iso: event.currency || 'XOF' },
            custom_metadata: {
                eventId: event._id.toString(),
                tier: purchaseItems[0].tier,
                quantity: purchaseItems[0].quantity,
                items: JSON.stringify(purchaseItems.map(item => ({ tier: item.tier, quantity: item.quantity }))),
                userId: userId.toString(),
                totalQuantity: totalQuantity.toString()
            },
            callback_url: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/tickets/webhook`,
            customer: {
                email: req.user.email,
                firstname: req.user.name,
                lastname: req.user.name
            }
        });

        res.status(201).json({
            requiresPayment: true,
            transactionId: transaction.id,
            transactionStatus: transaction.status,
            publicKey: process.env.FEDAPAY_PUBLIC_KEY,
            environment: process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox',
            amount: totalAmount,
            currency: event.currency || 'XOF',
            eventId: event._id,
            tier: purchaseItems[0].tier,
            items: purchaseItems.map(item => ({ tier: item.tier, quantity: item.quantity, unitPrice: item.unitPrice })),
            eventTitle: event.title
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const confirmPayment = async (req, res) => {
    try {
        const { transactionId } = req.body;

        if (!transactionId) {
            return res.status(400).json({ message: 'transactionId is required' });
        }

        configureFedaPay();

        const transaction = await Transaction.retrieve(transactionId);
        const status = transaction?.status || '';

        if (status !== 'approved') {
            return res.status(400).json({ message: 'Transaction not approved yet', status });
        }

        const metadata = transaction.custom_metadata || transaction.metadata || {};

        if (metadata.userId && metadata.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized for this transaction' });
        }

        const tickets = await processApprovedFedapayTransaction(transaction);

        res.status(201).json({
            message: tickets.length > 1 ? 'Tickets created successfully' : 'Ticket created successfully',
            ticket: tickets[0],
            tickets
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const ticketWebhook = async (req, res) => {
    try {
        configureFedaPay();

        const signature = req.headers['x-fedapay-signature'];
        const endpointSecret = process.env.FEDAPAY_WEBHOOK_SECRET;

        if (!endpointSecret) {
            return res.status(500).json({ message: 'FEDAPAY_WEBHOOK_SECRET is not configured' });
        }

        let event;

        try {
            event = Webhook.constructEvent(req.body, signature, endpointSecret);
        } catch (error) {
            return res.status(400).json({ message: `Webhook Error: ${error.message}` });
        }

        if (event?.name !== 'transaction.approved') {
            return res.status(200).json({ received: true, ignored: true });
        }

        const transactionId = event.object_id || event?.entity?.id || event?.entity?.object_id;

        if (!transactionId) {
            return res.status(200).json({ received: true, ignored: true });
        }

        const transaction = await Transaction.retrieve(transactionId);
        if (!transaction || transaction.status !== 'approved') {
            return res.status(200).json({ received: true, ignored: true });
        }

        await processApprovedFedapayTransaction(transaction);

        return res.status(200).json({ received: true });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 2. Mes tickets (pour le participant)
export const getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user._id })
            .populate('event', 'title date location image')
            .sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Générer le Token QR Dynamique (Valide 1 minute)
export const generateQRToken = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticket = await Ticket.findById(ticketId);

        if (!ticket || ticket.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Token très court pour empêcher les captures d'écran
        const token = jwt.sign(
            { ticketId: ticket._id, type: 'entry_qr' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1m' }
        );

        res.json({ qrToken: token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Scanner un ticket (Staff)
export const scanTicket = async (req, res) => {
    try {
        const { qrToken, action } = req.body; // action: 'in' (entrer) ou 'out' (sortir)
        const staffId = req.user._id;

        // Déchiffrer le token
        let decoded;
        try {
            decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ message: 'Code QR expiré ou invalide. Veuillez rafraîchir.' });
        }

        if (decoded.type !== 'entry_qr') {
            return res.status(400).json({ message: 'Type de QR invalide' });
        }

        const ticket = await Ticket.findById(decoded.ticketId).populate('event');
        if (!ticket) return res.status(404).json({ message: 'Ticket introuvable' });

        // Refuse scans after event end (ticket not valid anymore)
        const eventEndAt = ticket.event?.endAt || ticket.event?.date;
        const eventStartAt = ticket.event?.startAt || ticket.event?.date;

        if (!eventStartAt || !eventEndAt) {
            return res.status(400).json({ message: "Événement invalide (dates manquantes)" });
        }

        const now = new Date();
        if (now < new Date(eventStartAt)) {
            return res.status(400).json({ message: "L'événement n'a pas encore commencé." });
        }
        if (now > new Date(eventEndAt)) {
            return res.status(400).json({ message: "Cet événement est terminé. Le billet n'est plus valable." });
        }

        // Vérifier que le staff a le droit (appartient à l'orga de l'événement)
        const org = await Organization.findOne({ _id: ticket.event.organization, members: staffId });
        if (!org) {
            return res.status(403).json({ message: "Vous n'êtes pas autorisé à scanner pour cet événement." });
        }

        // Logique de scan ENTREE / SORTIE
        if (action === 'in') {
            if (ticket.status === 'checked_in') {
                return res.status(400).json({ status: 'error', message: 'UTILISATEUR DÉJÀ À L\'INTÉRIEUR !', ticket });
            }
            ticket.status = 'checked_in';
        } else if (action === 'out') {
            if (ticket.status === 'active' || ticket.status === 'checked_out') {
                return res.status(400).json({ status: 'error', message: 'L\'utilisateur n\'est pas à l\'intérieur !', ticket });
            }
            ticket.status = 'checked_out'; // Permet de rentrer à nouveau (active)
        } else {
            return res.status(400).json({ message: "Action invalide" });
        }

        // Log du scan
        ticket.scans.push({ action, scannedBy: staffId });
        await ticket.save();

        res.json({ 
            status: 'success', 
            message: action === 'in' ? 'ACCÈS AUTORISÉ' : 'SORTIE ENREGISTRÉE',
            ticketType: ticket.tier 
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. Liste des participants pour un événement (Organizer)
export const getEventAttendees = async (req, res) => {
    try {
        const { eventId } = req.params;
        const event = await Event.findById(eventId);
        
        if (!event || event.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Non autorisé' });
        }

        const tickets = await Ticket.find({ event: eventId })
            .populate('user', 'name email createdAt')
            .sort({ createdAt: -1 });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
