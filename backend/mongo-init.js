// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('marketing-analyzer');

// Create collections with validation
db.createCollection('analyses', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'fileName', 'uploadDate', 'status'],
      properties: {
        userId: {
          bsonType: 'string',
          description: 'User ID is required and must be a string'
        },
        fileName: {
          bsonType: 'string',
          description: 'File name is required and must be a string'
        },
        uploadDate: {
          bsonType: 'date',
          description: 'Upload date is required and must be a date'
        },
        status: {
          bsonType: 'string',
          enum: ['processing', 'completed', 'error'],
          description: 'Status must be one of the specified values'
        }
      }
    }
  }
});

db.createCollection('userpreferences', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId'],
      properties: {
        userId: {
          bsonType: 'string',
          description: 'User ID is required and must be a string'
        }
      }
    }
  }
});

// Create indexes for better performance
db.analyses.createIndex({ userId: 1 });
db.analyses.createIndex({ uploadDate: -1 });
db.analyses.createIndex({ status: 1 });
db.analyses.createIndex({ userId: 1, uploadDate: -1 });

db.userpreferences.createIndex({ userId: 1 }, { unique: true });

print('Marketing Analyzer database initialized successfully');
print('Collections created: analyses, userpreferences');
print('Indexes created for optimal query performance');