import { generateClient, GraphQLResult } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import { createUser, updateUser } from "../graphql/mutations";
import { GetUserQuery } from "../API";
import { getUser } from "../graphql/queries";

const client = generateClient();

interface GraphQLError {
  errors?: Array<{
    errorType?: string;
    message?: string;
  }>;
}

export async function ensureUserRecord() {
  try {
    const { username, signInDetails } = await getCurrentUser();

    // Get user details from social provider and ensure lowercase
    const displayName = (signInDetails?.loginId || username).toLowerCase();

    try {
      // Try to create the user
      const createResult = await client.graphql({
        query: createUser,
        variables: {
          input: {
            id: username,
            displayName: displayName,
            faceCount: 0,
          },
        },
      });

      return createResult.data?.createUser!;
    } catch (error) {
      const graphqlError = error as GraphQLError;
      // Check for DynamoDB conditional check failure or "already exists" error
      if (
        graphqlError.errors?.[0]?.errorType ===
          "ConditionalCheckFailedException" ||
        graphqlError.errors?.[0]?.message?.includes("already exists")
      ) {
        // User already exists, return
        const result = (await client.graphql({
          query: getUser,
          variables: { id: username },
        })) as GraphQLResult<GetUserQuery>;
    
        console.log(result);
    
        return result.data?.getUser!;
      } else {
        console.error("Unexpected error during user creation:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Error ensuring user record:", error);
    throw error;
  }
}
