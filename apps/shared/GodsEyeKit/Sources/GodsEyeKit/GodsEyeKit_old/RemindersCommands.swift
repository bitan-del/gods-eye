import Foundation

public enum GodsEyeRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum GodsEyeReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct GodsEyeRemindersListParams: Codable, Sendable, Equatable {
    public var status: GodsEyeReminderStatusFilter?
    public var limit: Int?

    public init(status: GodsEyeReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct GodsEyeRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct GodsEyeReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct GodsEyeRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [GodsEyeReminderPayload]

    public init(reminders: [GodsEyeReminderPayload]) {
        self.reminders = reminders
    }
}

public struct GodsEyeRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: GodsEyeReminderPayload

    public init(reminder: GodsEyeReminderPayload) {
        self.reminder = reminder
    }
}
