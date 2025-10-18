// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ExpenseManager
 * @dev Manages group expenses and peer-to-peer debt tracking on-chain
 * @notice This contract stores all expense data permanently on Base Sepolia
 *
 * Features:
 * - Multi-group support (single contract for all groups)
 * - Peer-to-peer debt tracking (who owes whom)
 * - IPFS hash storage for receipt images
 * - Access control (only group members can view/interact)
 * - ERC2771 support for gasless transactions (Base Paymaster)
 */
contract ExpenseManager is ERC2771Context, ReentrancyGuard {
    // ========== STRUCTS ==========

    struct Group {
        string groupId;           // XMTP conversation ID
        address[] members;        // List of group members
        uint256 createdAt;        // Timestamp of group creation
        bool exists;              // Flag to check if group exists
    }

    struct Expense {
        uint256 id;               // Unique expense ID
        string groupId;           // Group this expense belongs to
        address payer;            // Who paid for this expense
        string merchant;          // Merchant name
        uint256 totalAmount;      // Total amount in wei (or smallest unit)
        uint256 perPersonAmount;  // Amount each person owes
        string currency;          // Currency code (EUR, USD, etc.)
        string ipfsHash;          // IPFS CID of receipt image
        uint256 timestamp;        // When expense was created
        address[] participants;   // Who owes money (all members except payer)
        string metadata;          // JSON string with items, tax, tip, etc.
    }

    struct Payment {
        uint256 expenseId;        // Which expense was paid
        address from;             // Who paid
        address to;               // Who received payment
        uint256 amount;           // Amount paid
        uint256 timestamp;        // When payment was made
        bool gasless;             // Whether this was a gasless transaction
    }

    // ========== STATE VARIABLES ==========

    // Mapping: groupId => Group
    mapping(string => Group) public groups;

    // Array of all group IDs for enumeration
    string[] public groupIds;

    // Mapping: expenseId => Expense
    mapping(uint256 => Expense) public expenses;

    // Counter for expense IDs
    uint256 public expenseCounter;

    // Mapping: groupId => expenseIds[]
    mapping(string => uint256[]) public groupExpenses;

    // Mapping: paymentId => Payment
    mapping(uint256 => Payment) public payments;

    // Counter for payment IDs
    uint256 public paymentCounter;

    // Mapping: groupId => from => to => amount (debt tracking)
    mapping(string => mapping(address => mapping(address => uint256))) public debts;

    // Mapping: address => groupIds[] (groups a user belongs to)
    mapping(address => string[]) public userGroups;

    // ========== EVENTS ==========

    event GroupCreated(string indexed groupId, address[] members, uint256 timestamp);
    event MemberAdded(string indexed groupId, address member, uint256 timestamp);
    event ExpenseAdded(
        uint256 indexed expenseId,
        string indexed groupId,
        address indexed payer,
        uint256 totalAmount,
        uint256 perPersonAmount,
        string currency,
        string ipfsHash,
        uint256 timestamp
    );
    event PaymentMarked(
        uint256 indexed paymentId,
        uint256 indexed expenseId,
        address indexed from,
        address to,
        uint256 amount,
        bool gasless,
        uint256 timestamp
    );
    event DebtUpdated(
        string indexed groupId,
        address indexed from,
        address indexed to,
        uint256 newAmount
    );

    // ========== MODIFIERS ==========

    modifier onlyGroupMember(string memory groupId) {
        require(groups[groupId].exists, "Group does not exist");
        require(isGroupMember(groupId, _msgSender()), "Not a group member");
        _;
    }

    modifier groupExists(string memory groupId) {
        require(groups[groupId].exists, "Group does not exist");
        _;
    }

    // ========== CONSTRUCTOR ==========

    /**
     * @param trustedForwarder Address of the ERC2771 forwarder for gasless transactions
     */
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {
        expenseCounter = 1; // Start from 1
        paymentCounter = 1;
    }

    // ========== GROUP MANAGEMENT ==========

    /**
     * @notice Creates a new group
     * @param groupId Unique identifier for the group (XMTP conversation ID)
     * @param members Array of member addresses
     */
    function createGroup(
        string memory groupId,
        address[] memory members
    ) external {
        require(!groups[groupId].exists, "Group already exists");
        require(members.length > 0, "Group must have at least one member");
        require(isMemberInArray(members, _msgSender()), "Creator must be a member");

        groups[groupId] = Group({
            groupId: groupId,
            members: members,
            createdAt: block.timestamp,
            exists: true
        });

        groupIds.push(groupId);

        // Add group to each member's list
        for (uint256 i = 0; i < members.length; i++) {
            userGroups[members[i]].push(groupId);
        }

        emit GroupCreated(groupId, members, block.timestamp);
    }

    /**
     * @notice Adds a member to an existing group
     * @param groupId The group ID
     * @param newMember Address of the new member
     */
    function addMember(
        string memory groupId,
        address newMember
    ) external onlyGroupMember(groupId) {
        require(!isGroupMember(groupId, newMember), "Already a member");

        groups[groupId].members.push(newMember);
        userGroups[newMember].push(groupId);

        emit MemberAdded(groupId, newMember, block.timestamp);
    }

    // ========== EXPENSE MANAGEMENT ==========

    /**
     * @notice Adds a new expense to a group
     * @param groupId The group this expense belongs to
     * @param merchant Merchant name
     * @param totalAmount Total amount of the expense
     * @param perPersonAmount Amount each person owes
     * @param currency Currency code
     * @param ipfsHash IPFS CID of the receipt image
     * @param metadata JSON string with additional data
     */
    function addExpense(
        string memory groupId,
        string memory merchant,
        uint256 totalAmount,
        uint256 perPersonAmount,
        string memory currency,
        string memory ipfsHash,
        string memory metadata
    ) external onlyGroupMember(groupId) nonReentrant {
        require(totalAmount > 0, "Total amount must be greater than 0");
        require(perPersonAmount > 0, "Per person amount must be greater than 0");
        require(bytes(merchant).length > 0, "Merchant name required");
        require(bytes(ipfsHash).length > 0, "IPFS hash required");

        uint256 expenseId = expenseCounter++;
        address payer = _msgSender();

        // Get all members except the payer
        address[] memory participants = new address[](groups[groupId].members.length - 1);
        uint256 participantIndex = 0;

        for (uint256 i = 0; i < groups[groupId].members.length; i++) {
            if (groups[groupId].members[i] != payer) {
                participants[participantIndex] = groups[groupId].members[i];
                participantIndex++;
            }
        }

        expenses[expenseId] = Expense({
            id: expenseId,
            groupId: groupId,
            payer: payer,
            merchant: merchant,
            totalAmount: totalAmount,
            perPersonAmount: perPersonAmount,
            currency: currency,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp,
            participants: participants,
            metadata: metadata
        });

        groupExpenses[groupId].push(expenseId);

        // Update debts: each participant owes perPersonAmount to payer
        for (uint256 i = 0; i < participants.length; i++) {
            debts[groupId][participants[i]][payer] += perPersonAmount;
            emit DebtUpdated(groupId, participants[i], payer, debts[groupId][participants[i]][payer]);
        }

        emit ExpenseAdded(
            expenseId,
            groupId,
            payer,
            totalAmount,
            perPersonAmount,
            currency,
            ipfsHash,
            block.timestamp
        );
    }

    // ========== PAYMENT MANAGEMENT ==========

    /**
     * @notice Marks a debt as paid (gasless transaction supported)
     * @param expenseId The expense being paid
     * @param creditor The person receiving the payment
     */
    function markAsPaid(
        uint256 expenseId,
        address creditor
    ) external nonReentrant {
        require(expenses[expenseId].id == expenseId, "Expense does not exist");

        Expense memory expense = expenses[expenseId];
        address debtor = _msgSender();
        string memory groupId = expense.groupId;

        require(isGroupMember(groupId, debtor), "Not a group member");
        require(debts[groupId][debtor][creditor] > 0, "No debt to this creditor");

        uint256 amountPaid = expense.perPersonAmount;
        require(debts[groupId][debtor][creditor] >= amountPaid, "Debt amount mismatch");

        // Reduce debt
        debts[groupId][debtor][creditor] -= amountPaid;

        // Record payment
        uint256 paymentId = paymentCounter++;
        bool isGasless = _msgSender() != tx.origin; // Simple gasless detection

        payments[paymentId] = Payment({
            expenseId: expenseId,
            from: debtor,
            to: creditor,
            amount: amountPaid,
            timestamp: block.timestamp,
            gasless: isGasless
        });

        emit PaymentMarked(paymentId, expenseId, debtor, creditor, amountPaid, isGasless, block.timestamp);
        emit DebtUpdated(groupId, debtor, creditor, debts[groupId][debtor][creditor]);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Checks if an address is a member of a group
     * @param groupId The group ID
     * @param user The address to check
     * @return bool True if user is a member
     */
    function isGroupMember(string memory groupId, address user) public view returns (bool) {
        Group memory group = groups[groupId];
        for (uint256 i = 0; i < group.members.length; i++) {
            if (group.members[i] == user) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Gets all members of a group
     * @param groupId The group ID
     * @return address[] Array of member addresses
     */
    function getGroupMembers(string memory groupId) external view groupExists(groupId) returns (address[] memory) {
        return groups[groupId].members;
    }

    /**
     * @notice Gets all expense IDs for a group
     * @param groupId The group ID
     * @return uint256[] Array of expense IDs
     */
    function getGroupExpenses(string memory groupId) external view groupExists(groupId) returns (uint256[] memory) {
        return groupExpenses[groupId];
    }

    /**
     * @notice Gets debt amount from one user to another in a group
     * @param groupId The group ID
     * @param debtor The person who owes
     * @param creditor The person owed
     * @return uint256 The debt amount
     */
    function getDebt(
        string memory groupId,
        address debtor,
        address creditor
    ) external view groupExists(groupId) returns (uint256) {
        return debts[groupId][debtor][creditor];
    }

    /**
     * @notice Gets all debts for a user in a group (what they owe to each person)
     * @param groupId The group ID
     * @param user The user address
     * @return creditors Array of addresses the user owes
     * @return amounts Array of amounts owed to each creditor
     */
    function getUserDebts(
        string memory groupId,
        address user
    ) external view groupExists(groupId) returns (address[] memory creditors, uint256[] memory amounts) {
        Group memory group = groups[groupId];
        uint256 debtCount = 0;

        // First, count non-zero debts
        for (uint256 i = 0; i < group.members.length; i++) {
            if (debts[groupId][user][group.members[i]] > 0) {
                debtCount++;
            }
        }

        // Create arrays with exact size
        creditors = new address[](debtCount);
        amounts = new uint256[](debtCount);

        uint256 index = 0;
        for (uint256 i = 0; i < group.members.length; i++) {
            uint256 debt = debts[groupId][user][group.members[i]];
            if (debt > 0) {
                creditors[index] = group.members[i];
                amounts[index] = debt;
                index++;
            }
        }

        return (creditors, amounts);
    }

    /**
     * @notice Gets all credits for a user in a group (what others owe them)
     * @param groupId The group ID
     * @param user The user address
     * @return debtors Array of addresses who owe the user
     * @return amounts Array of amounts owed by each debtor
     */
    function getUserCredits(
        string memory groupId,
        address user
    ) external view groupExists(groupId) returns (address[] memory debtors, uint256[] memory amounts) {
        Group memory group = groups[groupId];
        uint256 creditCount = 0;

        // First, count non-zero credits
        for (uint256 i = 0; i < group.members.length; i++) {
            if (debts[groupId][group.members[i]][user] > 0) {
                creditCount++;
            }
        }

        // Create arrays with exact size
        debtors = new address[](creditCount);
        amounts = new uint256[](creditCount);

        uint256 index = 0;
        for (uint256 i = 0; i < group.members.length; i++) {
            uint256 credit = debts[groupId][group.members[i]][user];
            if (credit > 0) {
                debtors[index] = group.members[i];
                amounts[index] = credit;
                index++;
            }
        }

        return (debtors, amounts);
    }

    /**
     * @notice Gets all groups a user belongs to
     * @param user The user address
     * @return string[] Array of group IDs
     */
    function getUserGroups(address user) external view returns (string[] memory) {
        return userGroups[user];
    }

    /**
     * @notice Gets total number of groups
     * @return uint256 Number of groups
     */
    function getGroupCount() external view returns (uint256) {
        return groupIds.length;
    }

    /**
     * @notice Gets expense details by ID
     * @param expenseId The expense ID
     * @return Expense struct
     */
    function getExpense(uint256 expenseId) external view returns (Expense memory) {
        require(expenses[expenseId].id == expenseId, "Expense does not exist");
        return expenses[expenseId];
    }

    // ========== INTERNAL HELPERS ==========

    /**
     * @dev Checks if an address is in an array
     */
    function isMemberInArray(address[] memory array, address user) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == user) {
                return true;
            }
        }
        return false;
    }
}
