import Foundation
import Testing
@testable import GodsEye

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() throws {
        let tmp = try makeTempDirForTests()
        CommandResolver.setProjectRoot(tmp.path)

        let godseyePath = tmp.appendingPathComponent("node_modules/.bin/godseye")
        try makeExecutableForTests(at: godseyePath)

        let start = NodeServiceManager._testServiceCommand(["start"])
        #expect(start == [godseyePath.path, "node", "start", "--json"])

        let stop = NodeServiceManager._testServiceCommand(["stop"])
        #expect(stop == [godseyePath.path, "node", "stop", "--json"])
    }
}
