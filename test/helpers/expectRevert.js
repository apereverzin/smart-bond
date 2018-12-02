export default async promise => {
  try {
    await promise;
  } catch (error) {
    assert(
      error.message.search('revert') >= 0,
      'Expected throw, got \'' + error + '\' instead',
    );
    return;
  }
  assert.fail('Expected throw not received');
};
