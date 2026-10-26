import requests
import sys
import json
from datetime import datetime, timedelta

class CollaboratorPlatformTester:
    def __init__(self, base_url="https://teamtasks-38.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.manager_token = None
        self.collaborator_token = None
        self.manager_user = None
        self.collaborator_user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        print("\n🔍 Testing Health Check...")
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n🔍 Testing Authentication...")
        
        # Test login with existing manager
        success, response = self.run_test(
            "Manager Login",
            "POST",
            "auth/login",
            200,
            data={"email": "manager@example.com", "password": "password123"}
        )
        
        if success and 'access_token' in response:
            self.manager_token = response['access_token']
            self.manager_user = response['user']
            print(f"   Manager logged in: {self.manager_user['full_name']}")
        else:
            return False

        # Test login with existing collaborator
        success, response = self.run_test(
            "Collaborator Login",
            "POST",
            "auth/login",
            200,
            data={"email": "collaborator@example.com", "password": "password123"}
        )
        
        if success and 'access_token' in response:
            self.collaborator_token = response['access_token']
            self.collaborator_user = response['user']
            print(f"   Collaborator logged in: {self.collaborator_user['full_name']}")
        else:
            return False

        # Test invalid login
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@example.com", "password": "wrongpassword"}
        )

        return success

    def test_user_endpoints(self):
        """Test user-related endpoints"""
        print("\n🔍 Testing User Endpoints...")
        
        if not self.manager_token:
            print("❌ No manager token available for user tests")
            return False

        # Test get current user (manager)
        success, _ = self.run_test(
            "Get Current User (Manager)",
            "GET",
            "users/me",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        # Test get all users (manager only)
        success, response = self.run_test(
            "Get All Users (Manager)",
            "GET",
            "users",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        # Test get users with collaborator token (should fail)
        success, _ = self.run_test(
            "Get All Users (Collaborator - Should Fail)",
            "GET",
            "users",
            403,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        return True

    def test_task_management(self):
        """Test task management endpoints"""
        print("\n🔍 Testing Task Management...")
        
        if not self.manager_token or not self.collaborator_token:
            print("❌ Missing tokens for task tests")
            return False

        # Create a test task
        task_data = {
            "title": "Test Task for API Testing",
            "description": "This is a test task created during API testing",
            "assignee_id": self.collaborator_user['id'],
            "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
            "priority": "high"
        }

        success, task_response = self.run_test(
            "Create Task (Manager)",
            "POST",
            "tasks",
            200,
            data=task_data,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        if not success:
            return False

        task_id = task_response.get('id')
        print(f"   Created task ID: {task_id}")

        # Test create task with collaborator (should fail)
        success, _ = self.run_test(
            "Create Task (Collaborator - Should Fail)",
            "POST",
            "tasks",
            403,
            data=task_data,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        # Get tasks as manager
        success, manager_tasks = self.run_test(
            "Get Tasks (Manager)",
            "GET",
            "tasks",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        # Get tasks as collaborator
        success, collaborator_tasks = self.run_test(
            "Get Tasks (Collaborator)",
            "GET",
            "tasks",
            200,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        # Get specific task
        success, _ = self.run_test(
            "Get Specific Task (Manager)",
            "GET",
            f"tasks/{task_id}",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        success, _ = self.run_test(
            "Get Specific Task (Collaborator)",
            "GET",
            f"tasks/{task_id}",
            200,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        # Update task status (collaborator)
        success, _ = self.run_test(
            "Update Task Status (Collaborator)",
            "PUT",
            f"tasks/{task_id}",
            200,
            data={"status": "in_progress"},
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        # Complete task
        success, _ = self.run_test(
            "Complete Task (Collaborator)",
            "PUT",
            f"tasks/{task_id}",
            200,
            data={"status": "completed", "completed_at": datetime.now().isoformat()},
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        return True

    def test_performance_evaluation(self):
        """Test performance evaluation endpoints"""
        print("\n🔍 Testing Performance Evaluation...")
        
        if not self.manager_token or not self.collaborator_token:
            print("❌ Missing tokens for performance tests")
            return False

        # Get tasks to find a completed one
        success, tasks_response = self.run_test(
            "Get Tasks for Performance Test",
            "GET",
            "tasks",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        if not success or not tasks_response:
            print("❌ No tasks available for performance evaluation test")
            return False

        # Find a completed task
        completed_task = None
        for task in tasks_response:
            if task.get('status') == 'completed':
                completed_task = task
                break

        if not completed_task:
            print("❌ No completed tasks available for performance evaluation")
            return False

        # Create performance evaluation
        evaluation_data = {
            "task_id": completed_task['id'],
            "collaborator_id": completed_task['assignee_id'],
            "punctuality_score": 4,
            "quality_score": 5,
            "comments": "Excellent work on this task. Completed on time with high quality."
        }

        success, _ = self.run_test(
            "Create Performance Evaluation (Manager)",
            "POST",
            "performance",
            200,
            data=evaluation_data,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        # Test create evaluation with collaborator (should fail)
        success, _ = self.run_test(
            "Create Performance Evaluation (Collaborator - Should Fail)",
            "POST",
            "performance",
            403,
            data=evaluation_data,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        # Get performance evaluations
        success, _ = self.run_test(
            "Get Performance Evaluations (Collaborator)",
            "GET",
            f"performance/{self.collaborator_user['id']}",
            200,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        success, _ = self.run_test(
            "Get Performance Evaluations (Manager)",
            "GET",
            f"performance/{self.collaborator_user['id']}",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        return True

    def test_notifications(self):
        """Test notification endpoints"""
        print("\n🔍 Testing Notifications...")
        
        if not self.collaborator_token:
            print("❌ Missing collaborator token for notification tests")
            return False

        # Get notifications
        success, notifications_response = self.run_test(
            "Get Notifications (Collaborator)",
            "GET",
            "notifications",
            200,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        if success and notifications_response:
            # Try to mark first notification as read
            for notification in notifications_response:
                if not notification.get('is_read'):
                    success, _ = self.run_test(
                        "Mark Notification as Read",
                        "PUT",
                        f"notifications/{notification['id']}/read",
                        200,
                        headers={"Authorization": f"Bearer {self.collaborator_token}"}
                    )
                    break

        return True

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoints"""
        print("\n🔍 Testing Dashboard Statistics...")
        
        # Test manager dashboard stats
        success, manager_stats = self.run_test(
            "Get Dashboard Stats (Manager)",
            "GET",
            "dashboard/stats",
            200,
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )

        if success:
            print(f"   Manager stats: {manager_stats}")

        # Test collaborator dashboard stats
        success, collaborator_stats = self.run_test(
            "Get Dashboard Stats (Collaborator)",
            "GET",
            "dashboard/stats",
            200,
            headers={"Authorization": f"Bearer {self.collaborator_token}"}
        )

        if success:
            print(f"   Collaborator stats: {collaborator_stats}")

        return True

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Collaborator Platform API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Run tests in order
        tests = [
            self.test_health_check,
            self.test_authentication,
            self.test_user_endpoints,
            self.test_task_management,
            self.test_performance_evaluation,
            self.test_notifications,
            self.test_dashboard_stats
        ]

        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test failed with exception: {str(e)}")

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Backend API tests mostly successful!")
        elif success_rate >= 60:
            print("⚠️  Backend API has some issues that need attention")
        else:
            print("🚨 Backend API has significant issues")

        return success_rate >= 80

def main():
    tester = CollaboratorPlatformTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())