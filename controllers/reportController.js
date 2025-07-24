// backend/controllers/reportController.js
const { sequelize } = require("../config/config");
const Order = require("../models/orders");
const { Payment } = require("../models/payment");
const moment = require("moment"); // For date manipulation
const { Op } = require('sequelize'); // Import Op for Sequelize operators

// Define the GST rate (e.g., 18%) - Common for all GST calculations
const GST_RATE = 0.18; 

// Helper function to calculate GST amount from total amount (amount includes GST)
const calculateGstAmount = (totalAmount) => {
  // Debugging: Log the totalAmount received
  console.log(`DEBUG (calculateGstAmount): Received totalAmount = ${totalAmount}`);
  if (totalAmount === null || isNaN(totalAmount) || totalAmount <= 0) {
    console.log(`DEBUG (calculateGstAmount): totalAmount is invalid (${totalAmount}), returning 0.`);
    return 0;
  }
  const subtotal = totalAmount / (1 + GST_RATE);
  const gst = totalAmount - subtotal;
  // Debugging: Log calculated subtotal and gst
  console.log(`DEBUG (calculateGstAmount): Calculated subtotal = ${subtotal}, GST = ${gst}`);
  return gst;
};

// Helper to get total sales for a given period
const calculateTotalSales = async (startDate, endDate) => {
  try {
    const result = await Payment.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'numberOfTransactions'] // Count transactions
      ],
      where: {
        status: 'Paid',
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      raw: true // Get plain data, not Sequelize instances
    });

    const totalSales = (result && result.length > 0 && result[0].totalSales !== null)
      ? parseFloat(result[0].totalSales) : 0;
    const numberOfTransactions = (result && result.length > 0 && result[0].numberOfTransactions !== null)
      ? parseInt(result[0].numberOfTransactions) : 0;

    return {
      totalSales: totalSales,
      numberOfTransactions: numberOfTransactions
    };
  } catch (error) {
    console.error(`Error calculating sales from ${startDate} to ${endDate}:`, error);
    throw new Error("Failed to calculate sales.");
  }
};

// Controller to get monthly sales report
exports.getMonthlySalesReport = async (req, res) => {
  try {
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    const { totalSales, numberOfTransactions } = await calculateTotalSales(startOfMonth, endOfMonth);

    const dailyBreakdown = await Payment.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'dailySales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'dailyTransactionsCount'] // Count daily transactions
      ],
      where: {
        status: 'Paid',
        createdAt: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Fetch all paid payments for the current month with necessary details
    const monthlyPayments = await Payment.findAll({
      attributes: [
        'id', 'customOrderId', 'phoneNumber', 'amount', 'status', 'createdAt', 'razorpayPaymentId', 'razorpayOrderId', 'tableNumber'
      ],
      where: {
        status: 'Paid',
        createdAt: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      },
      order: [['createdAt', 'ASC']], // Sort by date for grouping on frontend
      raw: true // Get plain data
    });

    let totalGstPaid = 0; // Initialize total GST for the month
    // Calculate GST for each individual payment and add payment type
    const monthlyTransactionsWithGst = monthlyPayments.map(payment => {
      const transactionAmount = parseFloat(payment.amount); // amount from DB is DECIMAL(10,2)
      const gstAmount = calculateGstAmount(transactionAmount);
      totalGstPaid += gstAmount; // Aggregate total GST
      // Debugging: Log each aggregated GST amount
      console.log(`DEBUG (monthlyTransactions loop): Payment ID=${payment.id}, Amount=${transactionAmount}, GST for this payment=${gstAmount.toFixed(2)}, Cumulative totalGstPaid=${totalGstPaid.toFixed(2)}`);
      return {
        ...payment,
        amount: transactionAmount.toFixed(2), // Format amount as string for consistency
        gstAmount: gstAmount.toFixed(2),     // Format GST as string
        type: payment.razorpayPaymentId ? 'Online' : 'Offline/Other', // Determine payment type
        customOrderId: String(payment.customOrderId) // Ensure customOrderId is a string
      };
    });

    console.log(`DEBUG (getMonthlySalesReport): Final totalGstPaid before sending to frontend = ${totalGstPaid.toFixed(2)}`);

    res.status(200).json({
      success: true,
      report: {
        month: moment().format('MMMMYYYY'), // Format for clarity in report
        totalSales: totalSales.toFixed(2), // Format for consistent output
        numberOfTransactions: numberOfTransactions,
        totalGstPaid: totalGstPaid.toFixed(2), // NEW: Include total GST paid
        dailyBreakdown: dailyBreakdown.map(d => ({ // Ensure numbers are parsed and formatted
            date: d.date,
            dailySales: parseFloat(d.dailySales || 0).toFixed(2),
            dailyTransactionsCount: parseInt(d.dailyTransactionsCount || 0),
        })),
        monthlyTransactions: monthlyTransactionsWithGst // Include detailed transactions with GST
      }
    });
  } catch (error) {
    console.error("Error fetching monthly sales report:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch monthly sales report." });
  }
};

// Controller to get daily sales, popular items, AND daily transactions
exports.getDailySalesAndTransactionsReport = async (req, res) => {
  try {
    const { date: selectedDate } = req.query; // Get date from query parameter

    let dateToReport;
    if (selectedDate) {
        // Parse the selected date from the query. Use moment for robust parsing.
        dateToReport = moment(selectedDate, 'YYYY-MM-DD').toDate();
        // Validate if the parsed date is valid
        if (!moment(dateToReport).isValid()) {
            return res.status(400).json({ success: false, message: "Invalid date format. Please use YYYY-MM-DD." });
        }
    } else {
        dateToReport = moment().toDate(); // Default to today if no date is provided
    }

    const startOfDay = moment(dateToReport).startOf('day').toDate();
    const endOfDay = moment(dateToReport).endOf('day').toDate();

    const { totalSales: totalSalesToday, numberOfTransactions: numberOfTransactionsToday } = await calculateTotalSales(startOfDay, endOfDay);

    // Fetch popular items for the selected day
    const ordersToday = await Order.findAll({
      where: {
        paymentStatus: 'Paid', // Assuming popular items are from paid orders
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      attributes: ['items'],
      raw: true
    });

    const itemCounts = {};
    ordersToday.forEach(order => {
      if (order.items) {
        let itemsArray = [];
        try {
            itemsArray = JSON.parse(order.items);
        } catch (e) {
            console.error("Error parsing order items for popular items report:", order.items, e);
            return;
        }
        
        if (Array.isArray(itemsArray)) {
            itemsArray.forEach(item => {
                const itemName = item.name;
                const quantity = parseFloat(item.quantity) || 0;
                if (itemName) {
                    itemCounts[itemName] = (itemCounts[itemName] || 0) + quantity;
                }
            });
        }
      }
    });

    const popularItems = Object.entries(itemCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([name, count]) => ({ name, quantitySold: count }));

    // Fetch all transactions for the selected day
    const dailyPayments = await Payment.findAll({
      attributes: [
        'id', 'customOrderId', 'phoneNumber', 'amount', 'status', 'createdAt', 'razorpayPaymentId', 'razorpayOrderId', 'tableNumber'
      ],
      where: {
        createdAt: { // Fetch all transactions, regardless of status for this report
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      // Sort: 'Paid' first, then 'Failed', 'Refunded'. Within those, sort by time.
      order: [
        [sequelize.literal(`CASE WHEN status = 'Paid' THEN 1 WHEN status = 'Failed' THEN 2 ELSE 3 END`), 'ASC'],
        ['createdAt', 'ASC']
      ],
      raw: true // Get plain data
    });

    let totalGstPaidDaily = 0; // Initialize total GST for the daily report
    const dailyTransactions = dailyPayments.map(payment => {
      const transactionAmount = parseFloat(payment.amount);
      const gstAmount = calculateGstAmount(transactionAmount);
      totalGstPaidDaily += gstAmount; // Aggregate daily GST

      return {
        id: payment.id,
        customOrderId: String(payment.customOrderId),
        phoneNumber: payment.phoneNumber,
        totalAmount: transactionAmount.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        razorpayOrderId: payment.razorpayOrderId || 'N/A',
        razorpayPaymentId: payment.razorpayPaymentId ? payment.razorpayPaymentId : 'N/A',
        type: payment.razorpayPaymentId ? 'Online' : 'Offline/Other',
        tableNumber: payment.tableNumber,
        status: payment.status,
        createdAt: payment.createdAt, // Keep original date for sorting display
      };
    });

    res.status(200).json({
      success: true,
      report: {
        date: moment(dateToReport).format('YYYY-MM-DD'),
        totalSalesToday: totalSalesToday.toFixed(2),
        numberOfTransactionsToday: numberOfTransactionsToday,
        totalGstPaid: totalGstPaidDaily.toFixed(2), // NEW: Include daily total GST paid
        popularItems: popularItems,
        dailyTransactions: dailyTransactions // NEW: Include detailed daily transactions
      }
    });
  } catch (error) {
    console.error("Error fetching daily sales and transactions report:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch daily sales and transactions report." });
  }
};

// Controller to get ALL transactions (online and offline) with GST details
// Renamed to getTodaysTransactions to differentiate from the enhanced daily report
exports.getTodaysTransactions = async (req, res) => {
  try {
    const startOfDay = moment().startOf('day').toDate();
    const endOfDay = moment().endOf('day').toDate();

    const payments = await Payment.findAll({
      attributes: [
        'id',
        'customOrderId',
        'phoneNumber',
        'amount',
        'razorpayOrderId',
        'razorpayPaymentId',
        'tableNumber',
        'status',
        'createdAt'
      ],
      where: {
        createdAt: { // Only for today's transactions
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      order: [['createdAt', 'DESC']] // Default sort by latest first
    });

    let totalGstPaid = 0;
    const transactions = [];

    for (const payment of payments) {
      const transactionAmount = parseFloat(payment.amount);
      const gstAmount = calculateGstAmount(transactionAmount);
      totalGstPaid += gstAmount;

      transactions.push({
        id: payment.id,
        customOrderId: payment.customOrderId,
        phoneNumber: payment.phoneNumber,
        totalAmount: transactionAmount.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        razorpayOrderId: payment.razorpayOrderId || 'N/A',
        razorpayPaymentId: payment.razorpayPaymentId ? payment.razorpayPaymentId : 'N/A',
        type: payment.razorpayPaymentId ? 'Online' : 'Offline/Other',
        tableNumber: payment.tableNumber,
        status: payment.status,
        date: payment.createdAt,
      });
    }

    res.status(200).json({
      success: true,
      transactions,
      totalGstPaid: totalGstPaid.toFixed(2),
      message: "Transactions report fetched successfully."
    });

  } catch (error) {
    console.error("Error fetching all transactions report:", error);
    res.status(500).json({ success: false, message: "Internal server error fetching all transactions report." });
  }
};
